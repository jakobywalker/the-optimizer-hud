#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import binascii
import json
import os
import random
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any

ROOT = Path(__file__).resolve().parent
DEFAULT_MANIFEST = ROOT / "art_manifest.json"
DEFAULT_OUTPUT_DIR = ROOT / "outputs"
VERIFIED_IMAGE_MODELS = frozenset(
    {
        "gemini-3.1-flash-image",
        "gemini-3-pro-image",
    }
)
SUPPORTED_ASPECT_RATIOS = frozenset(
    {"1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"}
)
SUPPORTED_IMAGE_SIZES = frozenset({"0.5K", "1K", "2K", "4K"})
SUPPORTED_OUTPUT_MIME_TYPES = frozenset({"image/png", "image/jpeg"})
TRANSIENT_STATUS_CODES = frozenset({408, 409, 429, 500, 502, 503, 504})
TASK_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]*$")
MIME_SUFFIX = {"image/png": ".png", "image/jpeg": ".jpg"}


class PipelineError(RuntimeError):
    """A safe, user-facing pipeline failure."""


@dataclass(frozen=True)
class TaskSpec:
    task_id: str
    filename: Path
    model: str
    aspect_ratio: str
    image_size: str
    output_mime_type: str
    references: tuple[Path, ...]
    prompt: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Optimizer production assets from art_manifest.json."
    )
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--only",
        nargs="+",
        metavar="TASK_ID",
        help="Generate only the listed task IDs, preserving manifest order.",
    )
    parser.add_argument(
        "--force", action="store_true", help="Replace existing selected outputs."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print the plan without loading credentials or calling Gemini.",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=3,
        help="Maximum attempts per task for transient failures (default: 3).",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.5,
        help="Seconds to wait between successful generation tasks (default: 1.5).",
    )
    args = parser.parse_args()
    if not 1 <= args.retries <= 8:
        parser.error("--retries must be between 1 and 8")
    if not 0 <= args.delay <= 300:
        parser.error("--delay must be between 0 and 300 seconds")
    return args


def require_text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise PipelineError(f"{label} must be a non-empty string")
    return value.strip()


def safe_relative_path(value: Any, label: str) -> Path:
    raw = require_text(value, label)
    if "\x00" in raw:
        raise PipelineError(f"{label} contains a null byte")
    windows_path = PureWindowsPath(raw)
    normalized = raw.replace("\\", "/")
    posix_path = PurePosixPath(normalized)
    if windows_path.is_absolute() or windows_path.drive or posix_path.is_absolute():
        raise PipelineError(f"{label} must be relative: {raw}")
    if not posix_path.parts or any(part in {"", ".", ".."} for part in posix_path.parts):
        raise PipelineError(f"{label} is unsafe: {raw}")
    return Path(*posix_path.parts)


def resolve_inside(base: Path, relative: Path, label: str) -> Path:
    resolved_base = base.resolve()
    candidate = (resolved_base / relative).resolve()
    try:
        candidate.relative_to(resolved_base)
    except ValueError as exc:
        raise PipelineError(f"{label} escapes its allowed directory: {relative}") from exc
    return candidate


def detect_image_mime(path: Path) -> str:
    header = path.read_bytes()[:16]
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "image/webp"
    raise PipelineError(f"Reference is not a supported PNG, JPEG, or WebP image: {path}")


def read_manifest(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise PipelineError(f"Manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise PipelineError(
            f"Manifest JSON is invalid at line {exc.lineno}, column {exc.colno}"
        ) from exc
    if not isinstance(data, dict):
        raise PipelineError("Manifest root must be a JSON object")
    return data


def validate_manifest(path: Path) -> tuple[dict[str, Any], list[TaskSpec]]:
    manifest_path = path.resolve()
    manifest = read_manifest(manifest_path)
    manifest_dir = manifest_path.parent
    global_prompt = require_text(
        manifest.get("global_style_prompt"), "global_style_prompt"
    )
    default_model = require_text(manifest.get("default_model"), "default_model")
    default_mime = require_text(
        manifest.get("default_output_mime_type", "image/png"),
        "default_output_mime_type",
    )
    if default_model not in VERIFIED_IMAGE_MODELS:
        raise PipelineError(f"Unverified image model: {default_model}")
    if default_mime not in SUPPORTED_OUTPUT_MIME_TYPES:
        raise PipelineError(f"Unsupported default output MIME type: {default_mime}")

    raw_tasks = manifest.get("tasks")
    if not isinstance(raw_tasks, list) or not raw_tasks:
        raise PipelineError("Manifest requires a non-empty tasks array")

    task_ids: set[str] = set()
    filenames: set[str] = set()
    specs: list[TaskSpec] = []
    for index, raw_task in enumerate(raw_tasks, start=1):
        if not isinstance(raw_task, dict):
            raise PipelineError(f"tasks[{index}] must be an object")
        prefix = f"tasks[{index}]"
        task_id = require_text(raw_task.get("id"), f"{prefix}.id")
        if not TASK_ID_PATTERN.fullmatch(task_id):
            raise PipelineError(
                f"{prefix}.id must contain only lowercase letters, numbers, and hyphens: {task_id}"
            )
        id_key = task_id.casefold()
        if id_key in task_ids:
            raise PipelineError(f"Duplicate task ID: {task_id}")
        task_ids.add(id_key)

        filename = safe_relative_path(raw_task.get("filename"), f"{prefix}.filename")
        filename_key = filename.as_posix().casefold()
        if filename_key in filenames:
            raise PipelineError(f"Duplicate output filename: {filename.as_posix()}")
        filenames.add(filename_key)

        model = require_text(raw_task.get("model", default_model), f"{prefix}.model")
        if model not in VERIFIED_IMAGE_MODELS:
            raise PipelineError(f"{prefix}.model is not a verified image model: {model}")
        aspect_ratio = require_text(
            raw_task.get("aspect_ratio"), f"{prefix}.aspect_ratio"
        )
        if aspect_ratio not in SUPPORTED_ASPECT_RATIOS:
            raise PipelineError(
                f"{prefix}.aspect_ratio is unsupported: {aspect_ratio}"
            )
        image_size = require_text(raw_task.get("image_size"), f"{prefix}.image_size")
        if image_size not in SUPPORTED_IMAGE_SIZES:
            raise PipelineError(f"{prefix}.image_size is unsupported: {image_size}")
        if image_size == "0.5K" and model != "gemini-3.1-flash-image":
            raise PipelineError(
                f"{prefix}.image_size 0.5K is only supported by gemini-3.1-flash-image"
            )

        output_mime = require_text(
            raw_task.get("output_mime_type", default_mime),
            f"{prefix}.output_mime_type",
        )
        if output_mime not in SUPPORTED_OUTPUT_MIME_TYPES:
            raise PipelineError(
                f"{prefix}.output_mime_type is unsupported: {output_mime}"
            )
        expected_suffix = MIME_SUFFIX[output_mime]
        actual_suffix = filename.suffix.casefold()
        if output_mime == "image/jpeg" and actual_suffix == ".jpeg":
            actual_suffix = ".jpg"
        if actual_suffix != expected_suffix:
            raise PipelineError(
                f"{prefix}.filename extension does not match {output_mime}: {filename}"
            )

        prompt = require_text(raw_task.get("prompt"), f"{prefix}.prompt")
        prompt_policy = f"{global_prompt}\n{prompt}".casefold()
        if not any(
            marker in prompt_policy
            for marker in ("do not bake", "no text", "no readable text", "no title")
        ):
            raise PipelineError(
                f"{prefix}.prompt must prohibit baked-in readable UI text"
            )

        raw_references = raw_task.get("references")
        if not isinstance(raw_references, list) or not raw_references:
            raise PipelineError(f"{prefix}.references must contain at least one image")
        references: list[Path] = []
        reference_keys: set[str] = set()
        for ref_index, raw_reference in enumerate(raw_references, start=1):
            reference = safe_relative_path(
                raw_reference, f"{prefix}.references[{ref_index}]"
            )
            reference_key = reference.as_posix().casefold()
            if reference_key in reference_keys:
                raise PipelineError(
                    f"Duplicate reference in {task_id}: {reference.as_posix()}"
                )
            reference_keys.add(reference_key)
            reference_path = resolve_inside(
                manifest_dir, reference, f"{prefix}.references[{ref_index}]"
            )
            if not reference_path.is_file():
                raise PipelineError(f"Reference image not found: {reference.as_posix()}")
            detect_image_mime(reference_path)
            references.append(reference)

        specs.append(
            TaskSpec(
                task_id=task_id,
                filename=filename,
                model=model,
                aspect_ratio=aspect_ratio,
                image_size=image_size,
                output_mime_type=output_mime,
                references=tuple(references),
                prompt=prompt,
            )
        )
    return manifest, specs


def build_prompt(manifest: dict[str, Any], task: TaskSpec) -> str:
    return (
        "STYLE REFERENCE INSTRUCTION\n"
        "Use the supplied image input as a style reference.\n"
        "Do not recreate the presentation board.\n"
        "Return one clean production asset.\n\n"
        f"GLOBAL VISUAL DIRECTION\n{manifest['global_style_prompt'].strip()}\n\n"
        f"PRODUCTION ASSET REQUEST\n{task.prompt}\n\n"
        "Return exactly one image. Do not return a contact sheet, presentation board, "
        "interface mockup, readable labels, navigation, buttons, charts, or fake UI text."
    )


def image_input(manifest_dir: Path, reference: Path) -> dict[str, str]:
    reference_path = resolve_inside(manifest_dir, reference, "reference")
    mime_type = detect_image_mime(reference_path)
    return {
        "type": "image",
        "data": base64.b64encode(reference_path.read_bytes()).decode("ascii"),
        "mime_type": mime_type,
    }


def request_inputs(
    manifest: dict[str, Any], manifest_dir: Path, task: TaskSpec
) -> list[dict[str, str]]:
    parts: list[dict[str, str]] = [
        {"type": "text", "text": build_prompt(manifest, task)}
    ]
    parts.extend(image_input(manifest_dir, reference) for reference in task.references)
    return parts


def response_format(task: TaskSpec) -> dict[str, str]:
    return {
        "type": "image",
        "mime_type": task.output_mime_type,
        "aspect_ratio": task.aspect_ratio,
        "image_size": task.image_size,
    }


def validate_image_bytes(data: bytes, mime_type: str) -> None:
    if not data:
        raise PipelineError("Gemini returned an empty image")
    if mime_type == "image/png" and not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise PipelineError("Gemini response is not a valid PNG image")
    if mime_type == "image/jpeg" and not data.startswith(b"\xff\xd8\xff"):
        raise PipelineError("Gemini response is not a valid JPEG image")


def exception_status(error: BaseException) -> int | None:
    for attribute in ("code", "status_code"):
        value = getattr(error, attribute, None)
        try:
            if value is not None:
                return int(value)
        except (TypeError, ValueError):
            continue
    response = getattr(error, "response", None)
    value = getattr(response, "status_code", None)
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def is_transient(error: BaseException) -> bool:
    status = exception_status(error)
    if status in TRANSIENT_STATUS_CODES:
        return True
    return isinstance(error, (ConnectionError, TimeoutError))


def describe_error(error: BaseException) -> str:
    status = exception_status(error)
    if status is not None:
        return f"{type(error).__name__} (HTTP {status})"
    if isinstance(error, (PipelineError, ValueError, OSError)):
        message = str(error).replace("\n", " ").strip()
        return f"{type(error).__name__}: {message[:240]}"
    return type(error).__name__


def atomic_write(path: Path, data: bytes) -> Path:
    temporary = path.with_name(f"{path.name}.part")
    temporary.write_bytes(data)
    return temporary


def atomic_write_text(path: Path, text: str) -> Path:
    temporary = path.with_name(f"{path.name}.part")
    temporary.write_text(text, encoding="utf-8")
    return temporary


def generate_task(
    client: Any,
    manifest: dict[str, Any],
    manifest_dir: Path,
    task: TaskSpec,
    output_root: Path,
    attempts: int,
    force: bool,
) -> str:
    output_path = resolve_inside(output_root, task.filename, "output filename")
    metadata_path = Path(f"{output_path}.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if output_path.exists() and not force:
        if metadata_path.exists():
            return f"SKIP {task.task_id} -> {output_path}"
        raise PipelineError(
            f"Existing output has no metadata sidecar; rerun with --force: {output_path}"
        )

    effective_prompt = build_prompt(manifest, task)
    image_temporary = output_path.with_name(f"{output_path.name}.part")
    metadata_temporary = metadata_path.with_name(f"{metadata_path.name}.part")
    last_error: BaseException | None = None
    attempts_used = 0
    try:
        for attempt in range(1, attempts + 1):
            attempts_used = attempt
            try:
                interaction = client.interactions.create(
                    model=task.model,
                    input=request_inputs(manifest, manifest_dir, task),
                    response_format=response_format(task),
                )
                output_image = getattr(interaction, "output_image", None)
                encoded = getattr(output_image, "data", None)
                if not encoded:
                    raise PipelineError("Gemini returned no output image")
                try:
                    image_bytes = base64.b64decode(encoded, validate=True)
                except (binascii.Error, ValueError) as exc:
                    raise PipelineError("Gemini returned invalid base64 image data") from exc
                validate_image_bytes(image_bytes, task.output_mime_type)

                metadata = {
                    "task_id": task.task_id,
                    "filename": task.filename.as_posix(),
                    "model": task.model,
                    "aspect_ratio": task.aspect_ratio,
                    "requested_size": task.image_size,
                    "output_mime_type": task.output_mime_type,
                    "prompt": effective_prompt,
                    "references": [reference.as_posix() for reference in task.references],
                    "generated_at": datetime.now(timezone.utc)
                    .isoformat()
                    .replace("+00:00", "Z"),
                }
                image_temporary = atomic_write(output_path, image_bytes)
                metadata_temporary = atomic_write_text(
                    metadata_path, json.dumps(metadata, indent=2, ensure_ascii=True) + "\n"
                )
                os.replace(metadata_temporary, metadata_path)
                os.replace(image_temporary, output_path)
                return f"OK   {task.task_id} -> {output_path}"
            except KeyboardInterrupt:
                raise
            except Exception as exc:  # The task loop handles and summarizes failures.
                last_error = exc
                if attempt >= attempts or not is_transient(exc):
                    break
                wait = min(60.0, (2 ** (attempt - 1)) + random.uniform(0.0, 0.75))
                print(
                    f"RETRY {task.task_id} in {wait:.1f}s after "
                    f"{describe_error(exc)} ({attempt}/{attempts})",
                    file=sys.stderr,
                )
                time.sleep(wait)
    finally:
        image_temporary.unlink(missing_ok=True)
        metadata_temporary.unlink(missing_ok=True)

    assert last_error is not None
    raise PipelineError(
        f"Failed {task.task_id} after {attempts_used} attempt(s): "
        f"{describe_error(last_error)}"
    )


def create_client() -> Any:
    api_key = os.getenv("GEMINI_API_KEY")
    dotenv_path = ROOT / ".env"
    if (not api_key or not api_key.strip()) and dotenv_path.is_file():
        try:
            from dotenv import load_dotenv
        except ImportError as exc:
            raise PipelineError(
                "python-dotenv is missing. Activate .venv and install requirements.txt."
            ) from exc
        load_dotenv(dotenv_path, override=False)
        api_key = os.getenv("GEMINI_API_KEY")

    if not api_key or not api_key.strip():
        raise PipelineError(
            "GEMINI_API_KEY is unavailable. Set it in the process environment or an ignored .env file."
        )

    try:
        from google import genai
    except ImportError as exc:
        raise PipelineError(
            "google-genai is missing. Activate .venv and install requirements.txt."
        ) from exc
    return genai.Client(api_key=api_key.strip())


def select_tasks(tasks: list[TaskSpec], requested: list[str] | None) -> list[TaskSpec]:
    if not requested:
        return tasks
    requested_keys = {task_id.casefold() for task_id in requested}
    known = {task.task_id.casefold() for task in tasks}
    missing = sorted(requested_keys - known)
    if missing:
        raise PipelineError(f"Unknown task IDs: {', '.join(missing)}")
    return [task for task in tasks if task.task_id.casefold() in requested_keys]


def print_plan(tasks: list[TaskSpec], output_root: Path) -> None:
    for task in tasks:
        output_path = resolve_inside(output_root, task.filename, "output filename")
        print(
            f"- {task.task_id}: model={task.model}, aspect={task.aspect_ratio}, "
            f"size={task.image_size}, output={output_path}"
        )


def run() -> int:
    args = parse_args()
    manifest_path = args.manifest.resolve()
    manifest, all_tasks = validate_manifest(manifest_path)
    tasks = select_tasks(all_tasks, args.only)
    output_root = args.output_dir.resolve()

    print(f"Validated manifest: {len(all_tasks)} task(s).")
    print(f"Selected for this run: {len(tasks)} task(s).")
    print_plan(tasks, output_root)
    if args.dry_run:
        print("Dry run complete. Gemini API calls: 0.")
        return 0

    client = create_client()
    failures: list[str] = []
    try:
        for index, task in enumerate(tasks, start=1):
            print(f"\n[{index}/{len(tasks)}] Generating {task.task_id}...")
            try:
                print(
                    generate_task(
                        client,
                        manifest,
                        manifest_path.parent,
                        task,
                        output_root,
                        args.retries,
                        args.force,
                    )
                )
            except KeyboardInterrupt:
                raise
            except Exception as exc:
                failures.append(task.task_id)
                print(f"FAIL {task.task_id}: {describe_error(exc)}", file=sys.stderr)
            else:
                if index < len(tasks):
                    time.sleep(args.delay)
    finally:
        close = getattr(client, "close", None)
        if callable(close):
            close()

    if failures:
        print(f"\nFailures: {', '.join(failures)}", file=sys.stderr)
        return 1
    print("\nAll selected assets generated.")
    return 0


def main() -> int:
    try:
        return run()
    except KeyboardInterrupt:
        print("\nInterrupted. Completed outputs are safe; rerun to resume.", file=sys.stderr)
        return 130
    except (PipelineError, OSError) as exc:
        print(f"ERROR: {describe_error(exc)}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())