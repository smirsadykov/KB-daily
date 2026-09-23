/* Self-check for habit schedules, run with: node test-schedule.mjs
   Pulls the real functions out of index.html so this can't drift from what ships. */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const script = html.split("<script>")[1].split("</script>")[0];

const grab = (re, what) => {
  const m = script.match(re);
  if (!m) throw new Error("couldn't find " + what + " in index.html");
  return m[0];
};
const source = [
  grab(/const DOW=\[[^\]]+\];/, "DOW"),
  grab(/const iso=[^\n]+/, "iso"),
  grab(/const parseDate=[^\n]+/, "parseDate"),
  grab(/const shift=[^\n]+/, "shift"),
  grab(/const DOWKEY=\{[^}]+\};/, "DOWKEY"),
  grab(/function parseSched\(name\)\{[\s\S]*?\n\}/, "parseSched"),
  grab(/function parseHeader\(text\)\{[\s\S]*?\n\}/, "parseHeader"),
  grab(/function parseTree\(raw,scheduled\)\{[\s\S]*?\n\}/, "parseTree"),
  grab(/const leavesOf=tree=>[\s\S]*?\n  : \[h\]\);/, "leavesOf"),
  grab(/function weekDays\(s\)\{[\s\S]*?\n\}/, "weekDays"),
  grab(/function cyclePhase\(sc,s,anchor\)\{[\s\S]*?\n\}/, "cyclePhase"),
  grab(/function runLength\(key,s,ticked,isSkipped,slipped\)\{[\s\S]*?\n\}/, "runLength"),
  grab(/function dueOn\(it,s,habitsFor,firstTick\)\{[\s\S]*?\n\}/, "dueOn"),
].join("\n");

const { parseSched, parseHeader, parseTree, leavesOf, dueOn, weekDays, cyclePhase, runLength } =
  new Function(source + "\nreturn {parseSched,parseHeader,parseTree,leavesOf,dueOn,weekDays,cyclePhase,runLength};")();

// 2026-09-14 is a Monday
const MON = "2026-09-14", TUE = "2026-09-15", WED = "2026-09-16", SUN = "2026-09-20";
const none = () => ({});

// --- parsing: the schedule leaves the name, so history keys stay stable ---
assert.deepEqual(parseSched("Sauna @mon,thu"), { name: "Sauna", sched: { type: "days", days: [1, 4] } });
assert.deepEqual(parseSched("Long run @2x"), { name: "Long run", sched: { type: "week", n: 2 } });
assert.deepEqual(parseSched("Read affirmations"), { name: "Read affirmations", sched: null });
assert.deepEqual(parseSched("Email @home stuff"), { name: "Email @home stuff", sched: null }, "only a trailing @token is a schedule");
assert.equal(parseSched("Sauna @mon,thu").name, parseSched("Sauna @tue").name, "changing the schedule must not change the key");

// --- fixed days ---
const sauna = leavesOf(parseTree("Sauna @mon,thu", true))[0];
assert.equal(sauna.key, "Sauna", "key excludes the schedule");
assert.equal(dueOn(sauna, MON, none), true, "due on Monday");
assert.equal(dueOn(sauna, TUE, none), false, "not due on Tuesday");
assert.equal(dueOn(sauna, TUE, d => (d === TUE ? { Sauna: true } : {})), true,
  "a habit ticked off-schedule still shows, so it can be un-ticked");

// --- weekly quota ---
const run = leavesOf(parseTree("Long run @2x", true))[0];
assert.equal(dueOn(run, MON, none), true, "nothing done yet this week");
assert.equal(dueOn(run, WED, d => (d === MON ? { "Long run": true } : {})), true, "one of two done");
const twice = d => (d === MON || d === TUE ? { "Long run": true } : {});
assert.equal(dueOn(run, WED, twice), false, "quota met — stops asking for the rest of the week");
assert.equal(dueOn(run, "2026-09-21", twice), true, "next Monday starts a fresh week");

// --- weeks run Monday to Sunday ---
assert.deepEqual(weekDays(SUN)[0], MON, "Sunday belongs to the week that began Monday");
assert.deepEqual(weekDays(MON)[6], SUN);
assert.equal(dueOn(run, SUN, twice), false, "Sunday is inside the week whose quota is met");

// --- sub-items inherit the parent's schedule, but can override it ---
const tree = parseTree("Gym @mon,wed\n  Squats\n  Bench @tue", true);
const kids = leavesOf(tree);
assert.deepEqual(kids.map(k => k.key), ["Gym/Squats", "Gym/Bench"]);
assert.equal(dueOn(kids[0], MON, none), true, "inherited: due Monday");
assert.equal(dueOn(kids[0], TUE, none), false, "inherited: not due Tuesday");
assert.equal(dueOn(kids[1], TUE, none), true, "own schedule wins over the parent's");
assert.equal(dueOn(kids[1], MON, none), false);

// --- an unscheduled habit is simply daily ---
const daily = leavesOf(parseTree("Read affirmations", true))[0];
for (const d of [MON, TUE, WED, SUN]) assert.equal(dueOn(daily, d, none), true);

// --- workout lines are not schedule-parsed; an @ there is just text ---
assert.equal(parseTree("Ride @zone2", false)[0].name, "Ride @zone2");

// --- written in Russian: the app is Russian now, so people type Russian ---
assert.deepEqual(parseSched("Сауна @пн,чт").sched, { type: "days", days: [1, 4] }, "Russian weekday names");
assert.equal(parseSched("Сауна @пн,чт").name, "Сауна");
assert.deepEqual(parseSched("Пробежка @2х").sched, { type: "week", n: 2 },
  "a Cyrillic х looks exactly like a Latin x — both must work");
assert.deepEqual(parseSched("Без кальяна @30д").sched, { type: "run", n: 30 }, "Cyrillic д for a run");
assert.deepEqual(parseSched("Витамины @30/30").sched, { type: "cycle", on: 30, off: 30 });
assert.equal(parseSched("Позвонить @маме").sched, null, "a Russian word after @ that isn't a schedule stays text");
console.log("schedule: 26 checks passed");

/* --- a course: N days on, N days off, anchored to the first tick --- */
const vits = leavesOf(parseTree("Take vitamins @30/30\n  Vitamin D\n  Omega-3", true));
assert.deepEqual(vits[0].sched, { type: "cycle", on: 30, off: 30 }, "sub-items inherit the course");
assert.equal(vits[0].key, "Take vitamins/Vitamin D", "the course leaves the name alone");

const START = "2026-09-22";
const at = n => { const d = new Date(2026, 8, 22); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const anchor = () => START;

assert.equal(dueOn(vits[0], START, none, anchor), true, "day 1: on");
assert.equal(dueOn(vits[0], at(29), none, anchor), true, "day 30: last day on");
assert.equal(dueOn(vits[0], at(30), none, anchor), false, "day 31: the break starts");
assert.equal(dueOn(vits[0], at(59), none, anchor), false, "day 60: last day of the break");
assert.equal(dueOn(vits[0], at(60), none, anchor), true, "day 61: the next course starts");
assert.equal(dueOn(vits[0], at(89), none, anchor), true, "day 90: still on");
assert.equal(dueOn(vits[0], at(90), none, anchor), false, "day 91: break again");

assert.equal(dueOn(vits[0], START, none, () => null), true, "never ticked: the course has not started");
assert.equal(dueOn(vits[0], "2026-09-01", none, anchor), true, "before the anchor, nothing to withhold");
assert.equal(dueOn(vits[0], at(40), d => (d === at(40) ? { "Take vitamins/Vitamin D": true } : {}), anchor), true,
  "taken during the break anyway: still shown, so it can be un-ticked");

assert.equal(cyclePhase({ on: 30, off: 30 }, at(45), START), 45, "phase counts from the anchor");
assert.equal(cyclePhase({ on: 30, off: 30 }, at(60), START), 0, "phase wraps at on+off");
assert.equal(cyclePhase({ on: 30, off: 30 }, at(5), null), null, "no anchor, no phase");

assert.equal(vits[0].owner, "Take vitamins", "a sub-item on an inherited course belongs to the group");
assert.equal(vits[1].owner, "Take vitamins");
assert.equal(dueOn(vits[1], at(30), none, k => (k === "Take vitamins" ? START : null)), false,
  "the course is anchored on the group, not on whichever vitamin was ticked first");
assert.equal(leavesOf(parseTree("Gym @mon\n  Squats", true))[0].owner, "Gym", "inherited day schedules group too");
assert.equal(leavesOf(parseTree("Gym\n  Squats @mon", true))[0].owner, undefined, "its own schedule, its own anchor");

assert.deepEqual(parseSched("Creatine @5/2").sched, { type: "cycle", on: 5, off: 2 }, "any on/off pair");
assert.equal(parseSched("Notes @home/work").sched, null, "a slash that isn't two numbers is just text");
console.log("course: 21 checks passed");

/* --- a run: N days held without a break, for abstinence --- */
const asceza = leavesOf(parseTree("Abstinence @30d\n  No hookah\n  No porn", true));
assert.deepEqual(asceza[0].sched, { type: "run", n: 30 }, "sub-items inherit the run");
assert.equal(asceza[0].key, "Abstinence/No hookah");
assert.equal(dueOn(asceza[0], MON, none, () => null), true, "a run is asked for every day");

const TODAY = "2026-09-23";
const back = n => { const d = new Date(2026, 8, 23); d.setDate(d.getDate() - n); return d.toLocaleDateString("en-CA"); };
const held = (...offsets) => { const set = new Set(offsets.map(back)); return k => set.has(k) };
const noSkip = () => false;

assert.equal(runLength("k", TODAY, () => false, noSkip), 0, "nothing held yet");
assert.equal(runLength("k", TODAY, held(0), noSkip), 1, "ticked today");
assert.equal(runLength("k", TODAY, held(0, 1, 2), noSkip), 3, "three days running");
assert.equal(runLength("k", TODAY, held(1, 2, 3), noSkip), 3,
  "today still open does not end the run — it just hasn't been added to yet");
assert.equal(runLength("k", TODAY, held(0, 1, 3, 4), noSkip), 2, "a gap two days back ends the count there");
assert.equal(runLength("k", TODAY, held(0, 1, 3, 4), k => k === back(2)), 4,
  "a day skipped on purpose bridges the run without counting");
assert.equal(runLength("k", TODAY, held(2, 3), noSkip), 0,
  "a slip yesterday resets it, whatever came before");

const runNote = n => (n >= 30 ? "held " + n + " days" : "day " + n + " of 30");
assert.equal(runNote(runLength("k", TODAY, held(0, 1, 2), noSkip)), "day 3 of 30");
assert.equal(runNote(30), "held 30 days");

/* --- a slip: the owner saying "I broke it" ends the run on that day --- */
const slippedOn = (...offsets) => { const set = new Set(offsets.map(back)); return k => set.has(k) };
assert.equal(runLength("k", TODAY, held(1, 2, 3), noSkip, slippedOn(0)), 0,
  "a slip today is zero now — not tomorrow, when an unticked day would have noticed");
assert.equal(runLength("k", TODAY, held(0, 1, 2, 3), noSkip, slippedOn(0)), 0, "a slip outranks a tick on the same day");
assert.equal(runLength("k", TODAY, held(0, 1, 3, 4, 5), noSkip, slippedOn(2)), 2, "a slip two days back: only the days after it count");
assert.equal(runLength("k", TODAY, held(0, 1, 3), k => k === back(2), slippedOn(2)), 2,
  "a skipped day bridges a run, but not if you slipped on it");
assert.equal(runLength("k", TODAY, held(0, 1, 2), noSkip), 3, "no slip record at all: counts as before");
console.log("run: 17 checks passed");

/* --- section headings: part of the list's shape, never part of a habit's key --- */
const parseTreeH = parseTree, leavesOfH = leavesOf;

assert.deepEqual(parseHeader("# Evening @18"), { header: true, name: "Evening", opens: 1080, key: "#Evening", kids: [] });
assert.equal(parseHeader("# Evening @18:30").opens, 1110, "minutes are honoured");
assert.equal(parseHeader("# Morning").opens, null, "a heading without an hour never folds");
assert.equal(parseHeader("#"), null, "a bare # is not a heading");

const withSections = "# Morning\nRead\n# Evening @18\nАскеза @30d\n  Без кальяна";
const flat = "Read\nАскеза @30d\n  Без кальяна";
assert.deepEqual(leavesOfH(parseTreeH(withSections, true)).map(l => l.key), leavesOfH(parseTreeH(flat, true)).map(l => l.key),
  "adding sections changes no habit key, so no history is orphaned");
assert.equal(parseTreeH("# Evening\n  stray", true)[1].key, "stray", "an indented line under a heading is a habit, not the heading's child");
assert.equal(parseTreeH("# Not a heading", false)[0].name, "# Not a heading", "workout lines are never headings");
console.log("sections: 7 checks passed");
