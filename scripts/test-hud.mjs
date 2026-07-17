import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../progression-engine.js";
import "../engagement-engine.js";
import "../gym-engine.js";
import "../hud-core.js";

const core = globalThis.OptimizerHudCore;
const tests = [];
const test = (name, run) => tests.push({ name, run });
const ids = prefix => { let value = 0; return () => `${prefix}-${++value}`; };
const copy = value => JSON.parse(JSON.stringify(value));

function legacyState() {
  return {
    player: { level: 3, xp: 120, xpGoal: 500 },
    top: { Energy: 40, Clarity: 60, Momentum: 50, Alignment: 45 },
    character: [["E", "Execution", 55]],
    bottleneck: { title: "Test bottleneck", sub: "Remove friction", items: [["Friction", "-10"]] },
    resources: [["T", "Time", 70], ["$", "Money", "$1,250"]],
    quest: { title: "Ship the test", next: "Run checks", stages: [["Plan", 100], ["Build", 40]] },
    daily: {
      date: "2026-07-14",
      night: [["Plan tomorrow", true], ["Prepare", false]],
      morning: [["Move", true]],
      priorities: ["Ship", "Recover"],
    },
    buffs: [["+", "Focus", "Clear target"]],
    activeDebuffs: [["-", "Friction", "Slow setup"]],
    missions: [{ name: "Test mission", theme: "green", reward: "Confidence", tasks: [["First task", true], ["Second task", false]] }],
    skills: [["Testing", 65]],
    habits: { week: "2026-07-13", names: ["Walk", "Sleep"], values: [[true, false, true, false, false, false, false], [true, true, false, false, false, false, false]] },
    base: [["H", "Home", 70]],
    party: ["Builder", ""],
    todayLeverage: "Finish the important work",
  };
}

function migrated(prefix = "id") {
  const legacy = legacyState();
  return core.migrateState(legacy, legacy, { idFactory: ids(prefix), now: "2026-07-15T12:00:00.000Z" });
}

function updatePatch(state, overrides = {}) {
  return {
    format: "optimizer-ai-update",
    schemaVersion: "1.0",
    updateId: "update-1",
    generatedAt: "2026-07-15T13:00:00.000Z",
    baseExportId: state.meta.lastHandoffId,
    title: "Tune energy",
    rationale: "Use the observed state.",
    operations: [{
      id: "op-energy",
      operation: "update",
      entityType: "topStat",
      entityId: state.top[0].id,
      path: "value",
      previousValue: state.top[0].value,
      value: 72,
      reason: "Reflect recovery",
    }],
    ...overrides,
  };
}

test("migrates legacy state without losing personalized values", () => {
  const state = migrated();
  assert.equal(state.meta.schemaVersion, 5);
  assert.equal(state.meta.appVersion, "1.4.0");
  assert.equal(state.missions[0].tasks[0].completed, true);
  assert.equal(state.quest.stages[1].value, 40);
  assert.equal(state.money.balance, 1250);
  assert.equal(state.todayLeverage, "Finish the important work");
  assert.equal(state.habits.items.find(item => item.name === "Walk").values[2], true);
});

test("generates stable IDs once and preserves them on later migrations", () => {
  const first = migrated("stable");
  const firstIds = [first.top[0].id, first.missions[0].id, first.missions[0].tasks[0].id, first.quest.stages[0].id, first.daily.night[0].id, first.habits.items[0].id, first.party[0].id];
  const second = core.migrateState(first, legacyState(), { idFactory: ids("replacement"), now: "2026-07-16T12:00:00.000Z" });
  const secondIds = [second.top[0].id, second.missions[0].id, second.missions[0].tasks[0].id, second.quest.stages[0].id, second.daily.night[0].id, second.habits.items[0].id, second.party[0].id];
  assert.deepEqual(secondIds, firstIds);
});

test("accepts an old full-save shape as migration input", () => {
  const imported = core.migrateState(copy(legacyState()), legacyState(), { idFactory: ids("import"), now: "2026-07-15T12:00:00.000Z" });
  assert.equal(imported.missions[0].tasks.length, 2);
  assert.equal(imported.resources.find(item => item.name === "Money").value, "$1,250");
  assert.equal(imported.money.history[0].balance, 1250);
});

test("records task completion and reopening without duplicate event IDs", () => {
  const state = migrated("event");
  const task = state.missions[0].tasks[1];
  task.completed = true;
  core.recordEvent(state, { id: "event-fixed", action: "task completed", entityType: "missionTask", entityId: task.id, entityName: task.name, previousValue: false, newValue: true }, { now: "2026-07-15T12:10:00.000Z", clientId: "client-a" });
  task.completed = false;
  core.recordEvent(state, { id: "event-reopen", action: "task reopened", entityType: "missionTask", entityId: task.id, entityName: task.name, previousValue: true, newValue: false }, { now: "2026-07-15T12:11:00.000Z", clientId: "client-a" });
  core.recordEvent(state, { id: "event-fixed", action: "task completed", entityType: "missionTask" }, { now: "2026-07-15T12:12:00.000Z" });
  assert.deepEqual(state.events.map(event => event.action), ["task completed", "task reopened"]);
});

test("archives daily completion before resetting", () => {
  const state = migrated("daily");
  const changed = core.archiveRollovers(state, { today: "2026-07-15", week: state.habits.week }, { now: "2026-07-15T12:00:00.000Z", idFactory: ids("daily-event") });
  assert.equal(changed, true);
  assert.equal(state.dailyHistory[0].completionPercent, 67);
  assert.equal(state.dailyHistory[0].completedActions.length, 2);
  assert.ok([...state.daily.night, ...state.daily.morning].every(item => !item.completed));
});

test("archives weekly habits before resetting", () => {
  const state = migrated("weekly");
  const changed = core.archiveRollovers(state, { today: state.daily.date, week: "2026-07-20" }, { now: "2026-07-20T12:00:00.000Z", idFactory: ids("week-event") });
  assert.equal(changed, true);
  assert.equal(state.weeklyHistory[0].habits.find(item => item.name === "Walk").completed, 2);
  assert.ok(state.habits.items.every(item => item.values.every(value => !value)));
});

test("builds a first handoff with no previous export", () => {
  const state = migrated("handoff-first");
  const handoff = core.buildHandoff(state, { exportId: "export-1", exportedAt: "2026-07-15T12:30:00.000Z" });
  assert.equal(handoff.format, "optimizer-ai-handoff");
  assert.equal(handoff.previousExportId, null);
  assert.equal(handoff.currentState.meta.schemaVersion, 5);
  assert.equal(Object.hasOwn(handoff.currentState, "rollback"), false);
});

test("includes only changes after the previous handoff", () => {
  const state = migrated("handoff-next");
  core.recordEvent(state, { id: "before", action: "task completed", entityType: "missionTask" }, { now: "2026-07-15T12:10:00.000Z" });
  const first = core.buildHandoff(state, { exportId: "export-1", exportedAt: "2026-07-15T12:30:00.000Z" });
  core.commitHandoff(state, first, { now: first.exportedAt, idFactory: ids("commit") });
  core.recordEvent(state, { id: "after", action: "task reopened", entityType: "missionTask" }, { now: "2026-07-15T12:40:00.000Z" });
  const second = core.buildHandoff(state, { exportId: "export-2", exportedAt: "2026-07-15T13:00:00.000Z" });
  assert.equal(second.previousExportId, "export-1");
  assert.deepEqual(second.changesSincePreviousHandoff.map(event => event.id), ["after"]);
});

test("validates and applies a compatible AI update", () => {
  const state = migrated("valid");
  state.meta.lastHandoffId = "export-1";
  const patch = updatePatch(state);
  const result = core.validateAiUpdate(state, patch);
  assert.equal(result.valid.length, 1);
  core.applyAiUpdate(state, result, ["op-energy"], { now: "2026-07-15T13:10:00.000Z", idFactory: ids("apply") });
  assert.equal(state.top[0].value, 72);
  assert.ok(state.rollback.stateBeforeUpdate);
  assert.ok(state.events.some(event => event.action === "AI update imported"));
});

test("rejects malformed patch metadata", () => {
  const state = migrated("malformed");
  const result = core.validateAiUpdate(state, { format: "wrong", schemaVersion: "0", operations: "nope" });
  assert.ok(result.errors.length >= 3);
});

test("blocks a mismatched base handoff", () => {
  const state = migrated("mismatch");
  state.meta.lastHandoffId = "export-current";
  const result = core.validateAiUpdate(state, updatePatch(state, { baseExportId: "export-old" }));
  assert.equal(result.baseMismatch, true);
  assert.ok(result.errors.some(error => error.includes("baseExportId")));
});

test("does not guess an unknown entity ID", () => {
  const state = migrated("unknown");
  const patch = updatePatch(state);
  patch.operations[0].entityId = "missing-id";
  const result = core.validateAiUpdate(state, patch);
  assert.equal(result.unresolved.length, 1);
  assert.equal(result.valid.length, 0);
});

test("separates previous-value conflicts", () => {
  const state = migrated("conflict");
  const patch = updatePatch(state);
  patch.operations[0].previousValue = 999;
  const result = core.validateAiUpdate(state, patch);
  assert.equal(result.conflicting.length, 1);
  assert.equal(result.valid.length, 0);
});

test("applies only selected operations", () => {
  const state = migrated("selective");
  const patch = updatePatch(state);
  patch.operations.push({ id: "op-clarity", operation: "update", entityType: "topStat", entityId: state.top[1].id, path: "value", previousValue: state.top[1].value, value: 80 });
  const result = core.validateAiUpdate(state, patch);
  core.applyAiUpdate(state, result, ["op-clarity"], { now: "2026-07-15T13:10:00.000Z", idFactory: ids("select") });
  assert.equal(state.top[0].value, 40);
  assert.equal(state.top[1].value, 80);
});

test("restores the pre-update state and retains an audit trail", () => {
  const state = migrated("rollback");
  const originalValue = state.top[0].value;
  const result = core.validateAiUpdate(state, updatePatch(state));
  core.applyAiUpdate(state, result, ["op-energy"], { now: "2026-07-15T13:10:00.000Z", idFactory: ids("rollback-apply") });
  const restored = core.restoreRollback(state, { now: "2026-07-15T13:20:00.000Z", idFactory: ids("rollback-event") });
  assert.equal(restored.top[0].value, originalValue);
  assert.equal(restored.rollback.stateBeforeUpdate, null);
  assert.ok(restored.events.some(event => event.action === "AI update imported"));
  assert.ok(restored.events.some(event => event.action === "AI update rolled back"));
});

test("preserves the money ledger and negates rolled-back AI entries", () => {
  const state = migrated("money");
  state.meta.lastHandoffId = "export-1";
  const openingBalance = state.money.balance;
  const patch = updatePatch(state, { operations: [{ id: "op-money", operation: "add", entityType: "money", entityId: "money", previousValue: openingBalance, value: { id: "ledger-ai", delta: 125, note: "Example income" } }] });
  const result = core.validateAiUpdate(state, patch);
  core.applyAiUpdate(state, result, ["op-money"], { now: "2026-07-15T13:10:00.000Z", idFactory: ids("money-apply") });
  assert.equal(state.money.balance, openingBalance + 125);
  const restored = core.restoreRollback(state, { now: "2026-07-15T13:20:00.000Z", idFactory: ids("money-rollback") });
  assert.equal(restored.money.balance, openingBalance);
  assert.equal(restored.money.history.find(entry => entry.id === "ledger-ai").undoneAt, "2026-07-15T13:20:00.000Z");
});

test("deduplicates histories during cloud conflict merging", () => {
  const local = migrated("cloud-local");
  const remote = copy(local);
  local.events.push({ id: "event-local", timestamp: "2026-07-15T14:00:00.000Z", action: "task completed" });
  remote.events.push({ id: "event-remote", timestamp: "2026-07-15T14:01:00.000Z", action: "task reopened" }, copy(local.events.at(-1)));
  local.checkIns.push({ id: "check-local", timestamp: "2026-07-15T14:00:00.000Z" });
  remote.checkIns.push({ id: "check-remote", timestamp: "2026-07-15T14:01:00.000Z" });
  local.handoffs.push({ exportId: "handoff-local", exportedAt: "2026-07-15T14:00:00.000Z" });
  remote.handoffs.push({ exportId: "handoff-remote", exportedAt: "2026-07-15T14:01:00.000Z" });
  local.dailyHistory.push({ id: "daily-local", archivedAt: "2026-07-14T23:59:00.000Z" });
  remote.weeklyHistory.push({ id: "weekly-remote", archivedAt: "2026-07-13T23:59:00.000Z" });
  local.money.history.push({ id: "ledger-local", ts: "2026-07-15T14:00:00.000Z", delta: 10, balance: 1260, note: "Local", type: "income", undoneAt: null });
  remote.money.history.push({ id: "ledger-remote", ts: "2026-07-15T14:01:00.000Z", delta: 20, balance: 1270, note: "Remote", type: "income", undoneAt: null });
  const merged = core.mergeCloudState(local, remote);
  assert.equal(new Set(merged.events.map(event => event.id)).size, merged.events.length);
  assert.ok(merged.events.some(event => event.id === "event-local"));
  assert.ok(merged.events.some(event => event.id === "event-remote"));
  assert.ok(merged.checkIns.some(checkIn => checkIn.id === "check-remote"));
  assert.ok(merged.handoffs.some(handoff => handoff.exportId === "handoff-remote"));
  assert.ok(merged.dailyHistory.some(day => day.id === "daily-local"));
  assert.ok(merged.weeklyHistory.some(week => week.id === "weekly-remote"));
  assert.ok(merged.money.history.some(entry => entry.id === "ledger-local"));
  assert.ok(merged.money.history.some(entry => entry.id === "ledger-remote"));
  assert.equal(merged.money.balance, 1280);
});

test("keeps the documented example handoff and AI update compatible", () => {
  const handoff = JSON.parse(readFileSync(new URL("../docs/examples/example-handoff.json", import.meta.url), "utf8"));
  const patch = JSON.parse(readFileSync(new URL("../docs/examples/example-ai-update.json", import.meta.url), "utf8"));
  const state = core.migrateState(handoff.currentState, handoff.currentState, { idFactory: ids("example"), now: handoff.exportedAt });
  state.meta.lastHandoffId = handoff.exportId;
  state.meta.lastHandoffAt = handoff.exportedAt;
  const result = core.validateAiUpdate(state, patch);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid.length, 4);
  assert.equal(result.conflicting.length, 0);
  assert.equal(result.unresolved.length, 0);
});
let passed = 0;
for (const { name, run } of tests) {
  try {
    await run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`HUD behavior tests passed: ${passed}/${tests.length}.`);
