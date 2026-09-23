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
