/* Self-check for the one-time habit migration, run with: node test-migrate.mjs
   It writes into the owner's own list, so it must add exactly what was asked,
   never duplicate, and never resurrect something they deleted. */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const script = html.split("<script>")[1].split("</script>")[0];
const src = script.match(/function addRequestedHabits\(text\)\{[\s\S]*?\n\}/);
if (!src) throw new Error("couldn't find addRequestedHabits in index.html");
const addRequestedHabits = new Function(src[0] + "\nreturn addRequestedHabits;")();

const current = `Read affirmations
Journal
  Brain dump
  10 ideas on one topic
Read my wins
Take vitamins
  Vitamin D
  Omega-3
  Creatine`;

const out = addRequestedHabits(current);
const lines = out.split("\n");

// the vitamins become a course, and only that line changes in place
assert.ok(lines.includes("Take vitamins @30/30"), "vitamins get the 30/30 course");
assert.equal(lines.filter(l => /^\S/.test(l) && /vitamin/i.test(l)).length, 1, "the vitamins line is changed, not duplicated");
assert.deepEqual(lines.slice(0, 9).map(l => l.replace(" @30/30", "")), current.split("\n"),
  "everything already there stays, in order");

// the new ones are appended
assert.ok(lines.includes("Пополнить список достижений"), "daily achievements");
assert.ok(lines.includes("Аскеза @30d"), "abstinence as a 30-day run");
for (const k of ["  Без кальяна", "  Без порно", "  Без лишних трат"]) assert.ok(lines.includes(k), k.trim());

// idempotent: running it on its own output changes nothing
assert.equal(addRequestedHabits(out), out, "a second pass adds nothing");

// already typed in by hand, in any wording: left alone
const typed = "Take vitamins @30/30\n  D\nAdd to my achievements\nAbstinence @30d\n  No hookah";
assert.equal(addRequestedHabits(typed), typed, "lines the owner already wrote are not added again");

// a vitamins line that already has its own schedule is not overridden
assert.ok(addRequestedHabits("Vitamins @mon,thu").startsWith("Vitamins @mon,thu\n"), "an existing schedule wins");

// sub-items named after vitamins are not mistaken for the parent
assert.ok(!addRequestedHabits("Supplements\n  Vitamin D").includes("Vitamin D @30/30"),
  "only a top-level vitamins line gets the course");

console.log("migrate: 12 checks passed");

/* --- the second migration: morning and evening sections --- */
const sectSrc = script.match(/function addSections\(text\)\{[\s\S]*?\n\}/);
if (!sectSrc) throw new Error("couldn't find addSections in index.html");
const addSections = new Function(sectSrc[0] + "\nreturn addSections;")();

const split = addSections(out).split("\n");         // `out` is the list after the first migration
assert.equal(split[0], "# Morning", "morning heading first");
const eveAt = split.indexOf("# Evening @18");
assert.ok(eveAt > 0, "evening heading, opening at 18:00");
const morningPart = split.slice(1, eveAt), eveningPart = split.slice(eveAt + 1);
assert.ok(morningPart.includes("Read affirmations") && morningPart.includes("Take vitamins @30/30"), "morning keeps the morning things");
assert.ok(eveningPart.includes("Пополнить список достижений"), "achievements are an end-of-day thing");
assert.deepEqual(eveningPart.slice(-4), ["Аскеза @30d", "  Без кальяна", "  Без порно", "  Без лишних трат"],
  "the abstinence block moves whole, children with it");
assert.equal(split.filter(l => !l.startsWith("#")).length, out.split("\n").length, "nothing lost, nothing added but the two headings");
assert.equal(addSections(addSections(out)), addSections(out), "a second pass changes nothing");
assert.equal(addSections("# Mine\nRead"), "# Mine\nRead", "a list with its own sections is left alone");
assert.equal(addSections("Read\nWalk"), "Read\nWalk", "nothing evening-like: nothing to split");
console.log("sections: 9 checks passed");

/* --- the third: headings in Russian, never touching a habit --- */
const ruSrc = script.match(/const ruHeadings=text=>[\s\S]*?\.join\("\\n"\);/);
if (!ruSrc) throw new Error("couldn't find ruHeadings in index.html");
const ruHeadings = new Function(ruSrc[0] + "\nreturn ruHeadings;")();
const ru = ruHeadings(addSections(out)).split("\n");
assert.equal(ru[0], "# Утро");
assert.ok(ru.includes("# Вечер @18"), "the evening heading keeps its hour");
assert.deepEqual(ru.filter(l => !l.startsWith("#")), addSections(out).split("\n").filter(l => !l.startsWith("#")),
  "not a single habit line changes");
assert.equal(ruHeadings("# Morning routine\nRead"), "# Morning routine\nRead", "only the exact headings it wrote");
assert.equal(ruHeadings(ruHeadings(addSections(out))), ruHeadings(addSections(out)), "a second pass changes nothing");
console.log("ru headings: 5 checks passed");

/* --- the fourth: vitamins into the Health section --- */
const hSrc = script.match(/function addHealth\(text\)\{[\s\S]*?\n\}/);
if (!hSrc) throw new Error("couldn't find addHealth in index.html");
const addHealth = new Function(hSrc[0] + "\nreturn addHealth;")();
const before = ruHeadings(addSections(out)), after = addHealth(before), hl = after.split("\n");
const hAt = hl.indexOf("# Здоровье");
assert.ok(hAt > hl.indexOf("# Вечер @18"), "the section goes last, so nothing else falls under it");
assert.deepEqual(hl.slice(hAt + 1), ["Take vitamins @30/30", "  Vitamin D", "  Omega-3", "  Creatine"], "the vitamins move whole");
assert.deepEqual([...hl].sort(), [...before.split("\n"), "# Здоровье"].sort(), "nothing lost, only the heading added");
assert.equal(addHealth(after), after, "a second pass changes nothing");
assert.equal(addHealth("Read\nWalk"), "Read\nWalk", "no vitamins: left alone");
console.log("health: 5 checks passed");

/* --- the fifth: reasons and banks written under an abstinence --- */
const nSrc = script.match(/function addNote\(text,re,extra\)\{[\s\S]*?\n\}/);
if (!nSrc) throw new Error("couldn't find addNote in index.html");
const addNote = new Function(nSrc[0] + "\nreturn addNote;")();
const hook = t => addNote(t, /^\s*без кальяна\s*(@\S+)?\s*$/i, ["ради: Свобода ездить куда хочу", "копилка: +2000 ₽ до 4200000"]);
const k1 = hook(after), kl = k1.split("\n"), ki = kl.indexOf("  Без кальяна");
assert.deepEqual(kl.slice(ki + 1, ki + 3), ["    ради: Свобода ездить куда хочу", "    копилка: +2000 ₽ до 4200000"], "written right under it, one level deeper");
assert.equal(hook(k1), k1, "a second pass changes nothing");
assert.equal(hook("Без кальяна\n  ради: своё"), "Без кальяна\n  ради: своё", "a reason already written wins");
assert.equal(addNote("Без порно @30d\nX", /^\s*без порно\s*(@\S+)?\s*$/i, ["ради: Энергия"]), "Без порно @30d\n  ради: Энергия\nX", "a top-level line, schedule and all");
console.log("notes: 4 checks passed");

/* --- the sixth: «Без лишних трат» out of the evening, run and bank with it --- */
const oSrc = script.match(/function spendingOut\(text\)\{[\s\S]*?\n\}/);
if (!oSrc) throw new Error("couldn't find spendingOut in index.html");
const spendingOut = new Function(oSrc[0] + "\nreturn spendingOut;")();
const list = "# Утро\nRead\n# Вечер @18\nАскеза @30d\n  Без кальяна\n    копилка Tank 300: +2000 ₽\n  Без лишних трат\n    копилка Tank 300: ₽\n  Без порно";
const moved = spendingOut(list);
assert.deepEqual(moved.split("\n").slice(0, 2), ["Без лишних трат @30d", "  копилка Tank 300: ₽"], "to the top, its run and bank with it");
assert.ok(moved.includes("  Без кальяна\n    копилка Tank 300: +2000 ₽\n  Без порно"), "the rest of the group stays as it was");
assert.equal(spendingOut(moved), moved, "a second pass changes nothing");
assert.equal(spendingOut("Траты @7d\n  Без лишних трат"), "Траты @7d\n  Без лишних трат", "only out of the Аскеза group it was written in");
console.log("spending out: 4 checks passed");
