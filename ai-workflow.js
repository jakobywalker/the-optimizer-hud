(() => {
  "use strict";

  const dataMenu = document.getElementById("dataMenu");
  const handoffButton = document.getElementById("aiHandoffBtn");
  const reportButton = document.getElementById("readableReportBtn");
  const checkInButton = document.getElementById("checkInBtn");
  const updateButton = document.getElementById("aiUpdateBtn");
  const updateFile = document.getElementById("aiUpdateFile");
  const undoButton = document.getElementById("undoAiBtn");
  if (!handoffButton || !updateFile) return;

  const style = document.createElement("style");
  style.textContent = `
    .ai-modal-sub{margin:0 0 12px;color:#9db8c5;font-size:11px;line-height:1.55}
    .ai-preview-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
    .ai-preview-head h3{margin:0;color:#d8f4ff;font-size:13px}.ai-preview-tools{display:flex;gap:6px;flex-wrap:wrap}
    .ai-preview-group{display:grid;gap:7px}.ai-preview-group h4{margin:7px 0 0;color:#68d3ff;font-size:10px;letter-spacing:.8px;text-transform:uppercase}
    .ai-op strong{display:block;color:#eaf9ff;font-size:11px}.ai-op .ai-tag{display:inline-block;margin-right:6px;padding:2px 5px;border:1px solid #2d657c;border-radius:3px;color:#8fdcff;font-size:8px;letter-spacing:.5px;text-transform:uppercase}
    .ai-op-diff{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px}.ai-op-diff div{min-width:0;padding:6px;border:1px solid #173b4c;border-radius:4px;background:#031017}
    .ai-op-diff span{display:block;margin-bottom:3px;color:#7898a7;font-size:8px;text-transform:uppercase}.ai-op-diff code{display:block;overflow-wrap:anywhere;white-space:pre-wrap;font-size:9px}
    .ai-empty{padding:16px;border:1px dashed #315466;color:#8ca6b3;text-align:center;font-size:10px}
    @media(max-width:760px){.ai-preview-head{display:block}.ai-preview-tools{margin-top:8px}.ai-op-diff{grid-template-columns:1fr}.ai-modal .modal-actions{padding-bottom:max(10px,env(safe-area-inset-bottom))}}
  `;
  document.head.appendChild(style);

  const shell = document.createElement("div");
  shell.innerHTML = `
    <div class="modal-backdrop" id="aiCheckInModal">
      <section class="modal ai-modal" role="dialog" aria-modal="true" aria-labelledby="aiCheckInTitle">
        <div class="modal-head"><h2 id="aiCheckInTitle">AI Handoff</h2><button class="icon-btn" type="button" data-ai-close="checkin" aria-label="Close">X</button></div>
        <div class="modal-body">
          <p class="ai-modal-sub" id="aiCheckInIntro">Add an optional condition snapshot before generating the authoritative handoff.</p>
          <form class="ai-sheet" id="aiCheckInForm">
            <div class="ai-grid">
              ${numberField("Energy", "energy", "0-100", 0, 100)}
              ${numberField("Clarity", "clarity", "0-100", 0, 100)}
              ${numberField("Momentum", "momentum", "0-100", 0, 100)}
              ${numberField("Alignment", "alignment", "0-100", 0, 100)}
              ${numberField("Stress", "stress", "0-100", 0, 100)}
              ${numberField("Sleep Hours", "sleepHours", "Hours", 0, 24, "0.25")}
              ${textField("Physical Condition", "physicalCondition")}
              ${textField("Emotional Condition", "emotionalCondition")}
              ${areaField("Short Note", "note")}
              ${areaField("Blockers", "blockers")}
              ${areaField("Significant Wins", "significantWins")}
            </div>
            <label class="ai-copy"><input type="checkbox" id="aiCopyStats"> Copy entered Energy, Clarity, Momentum, and Alignment values to visible HUD stats</label>
            <div class="ai-status" id="aiCheckInStatus">Every field is optional for a handoff. Check-ins are observational unless copying is explicitly selected.</div>
            <div class="modal-actions"><button class="btn" type="button" data-ai-close="checkin">CANCEL</button><button class="btn primary" type="submit" id="aiCheckInSubmit">GENERATE HANDOFF</button></div>
          </form>
        </div>
      </section>
    </div>
    <div class="modal-backdrop" id="aiPreviewModal">
      <section class="modal ai-modal" role="dialog" aria-modal="true" aria-labelledby="aiPreviewTitle">
        <div class="modal-head"><h2 id="aiPreviewTitle">AI Update Preview</h2><button class="icon-btn" type="button" data-ai-close="preview" aria-label="Close">X</button></div>
        <div class="modal-body">
          <div class="ai-preview-head"><div><h3 id="aiPatchTitle">Proposed HUD changes</h3><p class="ai-modal-sub" id="aiPatchRationale"></p></div><div class="ai-preview-tools"><button class="btn" type="button" id="aiSelectSafe">SELECT SAFE</button><button class="btn" type="button" id="aiClearSelection">CLEAR</button></div></div>
          <div class="ai-status" id="aiPreviewStatus"></div>
          <div class="ai-preview" id="aiPreviewList"></div>
          <div class="modal-actions"><button class="btn" type="button" data-ai-close="preview">CANCEL</button><button class="btn primary" type="button" id="aiApplyUpdate">APPLY SELECTED</button></div>
        </div>
      </section>
    </div>`;
  document.body.append(...shell.children);

  const checkInModal = document.getElementById("aiCheckInModal");
  const checkInForm = document.getElementById("aiCheckInForm");
  const checkInTitle = document.getElementById("aiCheckInTitle");
  const checkInIntro = document.getElementById("aiCheckInIntro");
  const checkInSubmit = document.getElementById("aiCheckInSubmit");
  const checkInStatus = document.getElementById("aiCheckInStatus");
  const previewModal = document.getElementById("aiPreviewModal");
  const previewList = document.getElementById("aiPreviewList");
  const previewStatus = document.getElementById("aiPreviewStatus");
  const applyButton = document.getElementById("aiApplyUpdate");
  let checkInMode = "handoff";
  let validation = null;

  handoffButton.addEventListener("click", () => openCheckIn("handoff"));
  checkInButton.addEventListener("click", () => openCheckIn("checkin"));
  reportButton.addEventListener("click", exportReadableReport);
  updateButton.addEventListener("click", () => { closeDataMenu(); updateFile.click(); });
  undoButton.addEventListener("click", undoAiUpdate);
  checkInForm.addEventListener("submit", submitCheckIn);
  updateFile.addEventListener("change", importAiUpdate);
  previewList.addEventListener("change", refreshApplyButton);
  document.getElementById("aiSelectSafe").addEventListener("click", () => {
    previewList.querySelectorAll('input[data-ai-operation][data-status="valid"]').forEach(input => { input.checked = true; });
    refreshApplyButton();
  });
  document.getElementById("aiClearSelection").addEventListener("click", () => {
    previewList.querySelectorAll("input[data-ai-operation]").forEach(input => { input.checked = false; });
    refreshApplyButton();
  });
  applyButton.addEventListener("click", applySelectedUpdate);
  document.addEventListener("click", event => {
    const close = event.target.closest("[data-ai-close]");
    if (close) closeModal(close.dataset.aiClose);
  });
  [checkInModal, previewModal].forEach(modal => modal.addEventListener("click", event => {
    if (event.target === modal) modal.classList.remove("open");
  }));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { checkInModal.classList.remove("open"); previewModal.classList.remove("open"); }
  });

  const originalRender = render;
  render = function renderWithAiControls() {
    originalRender();
    refreshUndoButton();
  };
  refreshUndoButton();

  function numberField(label, name, placeholder, min, max, step = "1") {
    return `<div class="ai-field"><label>${label}</label><input name="${name}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" placeholder="${placeholder}"></div>`;
  }

  function textField(label, name) {
    return `<div class="ai-field"><label>${label}</label><input name="${name}" maxlength="160" placeholder="Optional"></div>`;
  }

  function areaField(label, name) {
    return `<div class="ai-field wide"><label>${label}</label><textarea name="${name}" maxlength="800" placeholder="Optional"></textarea></div>`;
  }

  function openCheckIn(mode) {
    checkInMode = mode;
    checkInForm.reset();
    checkInStatus.classList.remove("error");
    if (mode === "handoff") {
      checkInTitle.textContent = "AI Handoff";
      checkInIntro.textContent = "Add an optional condition snapshot before generating the authoritative JSON handoff.";
      checkInSubmit.textContent = "GENERATE HANDOFF";
      checkInStatus.textContent = "Every field is optional. The handoff records only after the download is generated.";
    } else {
      checkInTitle.textContent = "Condition Check-In";
      checkInIntro.textContent = "Capture how the system feels right now without changing visible stats unless you explicitly copy them.";
      checkInSubmit.textContent = "SAVE CHECK-IN";
      checkInStatus.textContent = "Enter at least one observation. Visible stats remain unchanged by default.";
    }
    closeDataMenu();
    checkInModal.classList.add("open");
    checkInForm.querySelector("input")?.focus();
  }

  function readCheckIn() {
    const formData = new FormData(checkInForm);
    return Object.fromEntries(["energy", "clarity", "momentum", "alignment", "stress", "sleepHours", "physicalCondition", "emotionalCondition", "note", "blockers", "significantWins"].map(name => [name, String(formData.get(name) || "").trim()]));
  }

  function hasObservation(values) {
    return Object.values(values).some(value => value !== "");
  }

  function copyCheckInStats(values) {
    const names = { energy: "Energy", clarity: "Clarity", momentum: "Momentum", alignment: "Alignment" };
    for (const [key, label] of Object.entries(names)) {
      if (values[key] === "") continue;
      const target = state.top.find(item => item.name.toLowerCase() === label.toLowerCase());
      if (!target) continue;
      const next = Math.max(0, Math.min(100, Number(values[key])));
      recordChange("stat changed", "topStat", target, target.value, next, "Copied from condition check-in");
      target.value = next;
    }
  }

  function submitCheckIn(event) {
    event.preventDefault();
    const values = readCheckIn();
    const observed = hasObservation(values);
    if (checkInMode === "checkin" && !observed) {
      checkInStatus.textContent = "Enter at least one observation before saving the check-in.";
      checkInStatus.classList.add("error");
      return;
    }
    if (observed) core.createCheckIn(state, values, { clientId: hudClientId });
    if (document.getElementById("aiCopyStats").checked) copyCheckInStats(values);
    if (observed || document.getElementById("aiCopyStats").checked) saveState();
    if (checkInMode === "checkin") {
      render();
      checkInModal.classList.remove("open");
      toast("Condition check-in saved");
      return;
    }
    generateHandoff();
  }

  function generateHandoff() {
    try {
      updateInline();
      const handoff = core.buildHandoff(state);
      downloadFile(JSON.stringify(handoff, null, 2), `optimizer-handoff-${fileStamp(handoff.exportedAt)}.json`, "application/json");
      core.commitHandoff(state, handoff, { clientId: hudClientId });
      saveState();
      refreshUndoButton();
      checkInModal.classList.remove("open");
      toast("AI handoff exported");
    } catch (error) {
      checkInStatus.textContent = error.message || "The handoff could not be generated.";
      checkInStatus.classList.add("error");
    }
  }

  function exportReadableReport() {
    closeDataMenu();
    try {
      updateInline();
      const handoff = core.buildHandoff(state);
      downloadFile(core.handoffToMarkdown(handoff), `optimizer-handoff-${fileStamp(handoff.exportedAt)}.md`, "text/markdown");
      toast("Readable report exported");
    } catch (error) {
      alert(error.message || "The readable report could not be generated.");
    }
  }

  async function importAiUpdate() {
    const file = updateFile.files[0];
    if (!file) return;
    try {
      const patch = JSON.parse(await file.text());
      validation = core.validateAiUpdate(state, patch);
      renderPreview(validation);
    } catch (error) {
      validation = { patch: null, errors: [`Invalid JSON: ${error.message}`], warnings: [], valid: [], conflicting: [], unresolved: [], baseMismatch: false };
      renderPreview(validation);
    } finally {
      updateFile.value = "";
    }
  }

  function renderPreview(result) {
    const patch = result.patch || {};
    document.getElementById("aiPatchTitle").textContent = patch.title || "Proposed HUD changes";
    document.getElementById("aiPatchRationale").textContent = patch.rationale || "Review every operation before applying anything.";
    const messages = [...result.errors, ...result.warnings];
    previewStatus.classList.toggle("error", result.errors.length > 0);
    previewStatus.textContent = messages.length ? messages.join(" ") : `${result.valid.length} valid, ${result.conflicting.length} conflicting, ${result.unresolved.length} unresolved.`;
    const groups = [
      ["Safe Operations", result.valid, "valid"],
      ["Conflicts - review before selecting", result.conflicting, "conflict"],
      ["Unresolved - cannot apply", result.unresolved, "unresolved"],
    ];
    previewList.innerHTML = groups.filter(([, entries]) => entries.length).map(([title, entries, status]) => `
      <section class="ai-preview-group"><h4>${escapeHtml(title)} (${entries.length})</h4>${entries.map(entry => operationHtml(entry, status, result.errors.length > 0)).join("")}</section>`).join("") || '<div class="ai-empty">No operations were available to preview.</div>';
    previewModal.classList.add("open");
    refreshApplyButton();
  }

  function operationHtml(entry, status, globallyBlocked) {
    const operation = entry.operation;
    const disabled = status === "unresolved" || globallyBlocked;
    const checked = status === "valid" && !globallyBlocked;
    const proposed = proposedValue(operation);
    const current = status === "unresolved" ? "Unresolved" : entry.currentValue;
    return `<label class="ai-op ${status}"><input type="checkbox" data-ai-operation value="${escapeHtml(operation.id)}" data-status="${status}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}><div><strong><span class="ai-tag">${escapeHtml(operation.operation)}</span>${escapeHtml(operation.entityType)}${operation.path ? ` / ${escapeHtml(operation.path)}` : ""}</strong><small>ID: ${escapeHtml(operation.entityId || "new entity")} ${entry.reason ? `- ${escapeHtml(entry.reason)}` : ""}</small><div class="ai-op-diff"><div><span>Current</span><code>${escapeHtml(formatValue(current))}</code></div><div><span>Proposed</span><code>${escapeHtml(formatValue(proposed))}</code></div></div>${operation.reason ? `<small>Reason: ${escapeHtml(operation.reason)}</small>` : ""}</div></label>`;
  }

  function proposedValue(operation) {
    if (operation.operation === "complete") return true;
    if (operation.operation === "reopen") return false;
    if (operation.operation === "archive") return "archived";
    if (operation.operation === "remove") return null;
    return operation.value;
  }

  function formatValue(value) {
    if (value === undefined) return "undefined";
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    return text.length > 500 ? `${text.slice(0, 500)}...` : text;
  }

  function refreshApplyButton() {
    const selected = previewList.querySelectorAll("input[data-ai-operation]:checked:not(:disabled)").length;
    applyButton.disabled = !validation || validation.errors.length > 0 || selected === 0;
    applyButton.textContent = selected ? `APPLY SELECTED (${selected})` : "APPLY SELECTED";
  }

  function applySelectedUpdate() {
    const selected = [...previewList.querySelectorAll("input[data-ai-operation]:checked:not(:disabled)")].map(input => input.value);
    try {
      const applied = core.applyAiUpdate(state, validation, selected, { clientId: hudClientId });
      saveState();
      render();
      previewModal.classList.remove("open");
      toast(`${applied.length} AI update operation${applied.length === 1 ? "" : "s"} applied`);
    } catch (error) {
      previewStatus.textContent = error.message || "The AI update could not be applied.";
      previewStatus.classList.add("error");
    }
  }

  function undoAiUpdate() {
    closeDataMenu();
    if (!state.rollback?.stateBeforeUpdate) return toast("No AI update rollback is available");
    if (!confirm("Restore the complete snapshot from before the last AI update? Later changes made after that update will also be restored to that snapshot.")) return;
    try {
      state = core.restoreRollback(state, { clientId: hudClientId });
      normalizeState();
      saveState();
      render();
      toast("Last AI update rolled back");
    } catch (error) {
      alert(error.message || "The AI update could not be rolled back.");
    }
  }

  function refreshUndoButton() {
    undoButton.disabled = !state.rollback?.stateBeforeUpdate;
    undoButton.title = state.rollback?.stateBeforeUpdate ? `Restore snapshot before ${state.rollback.updateId}` : "No AI update rollback available";
  }

  function closeModal(name) {
    (name === "preview" ? previewModal : checkInModal).classList.remove("open");
  }

  function closeDataMenu() {
    if (dataMenu) dataMenu.open = false;
  }

  function fileStamp(value) {
    const date = new Date(value);
    const pad = number => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  }

  function downloadFile(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }
})();
