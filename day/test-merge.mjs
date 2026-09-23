/* Self-check for the sync merge, run with: node test-merge.mjs
   Pulls the real functions out of index.html so this can't drift from what ships. */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const script = html.split("<script>")[1].split("</script>")[0];

// the pieces the merge depends on, taken verbatim from the page
const grab = (re, what) => {
  const m = script.match(re);
  if (!m) throw new Error("couldn't find " + what + " in index.html");
  return m[0];
};
const source = [
  grab(/const LS="daydesk:";/, "LS"),
  grab(/const lsGet=[^\n]+/, "lsGet"),
  grab(/const lsSet=[^\n]+/, "lsSet"),
  grab(/function allLocal\(\)\{[\s\S]*?\n\}/, "allLocal"),
  grab(/function mergeRemote\(remote\)\{[\s\S]*?\n\}/, "mergeRemote"),
].join("\n");

// a stand-in for localStorage: keys live as own properties, as they do in a browser
const localStorage = {};
Object.defineProperties(localStorage, {
  getItem: { value: k => (k in localStorage ? localStorage[k] : null) },
  setItem: { value: (k, v) => { localStorage[k] = String(v) } },
  removeItem: { value: k => { delete localStorage[k] } },
});
globalThis.localStorage = localStorage;

const { allLocal, mergeRemote, lsGet, lsSet } = new Function(source + "\nreturn {allLocal,mergeRemote,lsGet,lsSet};")();

const reset = (docs = {}, stamps = {}) => {
  for (const k of Object.keys(localStorage)) delete localStorage[k];
  for (const [p, v] of Object.entries(docs)) localStorage["daydesk:" + p] = JSON.stringify(v);
  localStorage["daydesk:u"] = JSON.stringify(stamps);
};

// 1. a document the remote wrote later replaces the local copy
reset({ "days/2026-09-14": { tasks: ["mine"] } }, { "days/2026-09-14": 100 });
let r = mergeRemote({ u: { "days/2026-09-14": 200 }, docs: { "days/2026-09-14": { tasks: ["theirs"] } } });
assert.equal(r.pulled, 1, "newer remote should be pulled");
assert.deepEqual(lsGet("days/2026-09-14").tasks, ["theirs"]);
assert.equal(r.pushable, false, "nothing local is newer");

// 2. a document the local wrote later is kept and marked for push
reset({ "days/2026-09-14": { tasks: ["mine"] } }, { "days/2026-09-14": 300 });
r = mergeRemote({ u: { "days/2026-09-14": 200 }, docs: { "days/2026-09-14": { tasks: ["theirs"] } } });
assert.equal(r.pulled, 0, "older remote must not overwrite newer local");
assert.deepEqual(lsGet("days/2026-09-14").tasks, ["mine"]);
assert.equal(r.pushable, true, "newer local should push");

// 3. THE CASE THAT MATTERS: two devices, two different days — both survive
reset({ "days/2026-09-14": { tasks: ["phone"] } }, { "days/2026-09-14": 500 });
r = mergeRemote({ u: { "days/2026-09-13": 400 }, docs: { "days/2026-09-13": { tasks: ["laptop"] } } });
assert.deepEqual(lsGet("days/2026-09-14").tasks, ["phone"], "local-only day kept");
assert.deepEqual(lsGet("days/2026-09-13").tasks, ["laptop"], "remote-only day pulled");
assert.equal(r.pushable, true, "the local-only day still needs pushing");
assert.deepEqual(Object.keys(allLocal()).sort(), ["days/2026-09-13", "days/2026-09-14"]);

// 4. first sync ever: no remote file at all
reset({ "config/habits": { text: "Read" } }, { "config/habits": 100 });
r = mergeRemote(null);
assert.equal(r.pulled, 0);
assert.equal(r.pushable, true, "everything local must go up on the first sync");

// 5. already in step: nothing moves either way
reset({ "config/habits": { text: "Read" } }, { "config/habits": 100 });
r = mergeRemote({ u: { "config/habits": 100 }, docs: { "config/habits": { text: "Read" } } });
assert.equal(r.pulled, 0);
assert.equal(r.pushable, false);

// 6. the token never leaves this device
reset({ "config/habits": { text: "Read" }, sync: { repo: "me/daydesk", token: "secret" } }, { "config/habits": 100 });
assert.ok(!("sync" in allLocal()), "sync settings must never be part of the synced payload");
assert.ok(!JSON.stringify(allLocal()).includes("secret"), "token must never reach the repo");

// 7. "when did THIS device last export" is about this device only
reset({ "config/habits": { text: "Read" }, backup: { at: 1 } }, { "config/habits": 100 });
assert.ok(!("backup" in allLocal()), "a backup date synced to another device would tell it it was backed up");

console.log("merge: 7 checks passed");
