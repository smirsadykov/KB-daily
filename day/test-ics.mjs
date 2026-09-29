/* Self-check for the calendar reminder, run with: node test-ics.mjs
   Calendar apps reject a malformed file silently, so the format is pinned here
   against the functions pulled straight out of index.html. */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const script = html.split("<script>")[1].split("</script>")[0];
const grab = (re, what) => { const m = script.match(re); if (!m) throw new Error("couldn't find " + what); return m[0] };
const { icsEscape, icsFold, buildIcs } = new Function([
  grab(/const icsEscape=[^\n]+/, "icsEscape"),
  grab(/function icsFold\(line\)\{[\s\S]*?\n\}/, "icsFold"),
  grab(/function buildIcs\(time,now,url\)\{[\s\S]*?\n\}/, "buildIcs"),
].join("\n") + "\nreturn {icsEscape,icsFold,buildIcs};")();

const URLS = "https://smirsadykov.github.io/Habit-Dashboard/";
const morning = new Date(2026, 8, 24, 8, 30);      // 08:30 local
const ics = buildIcs("21:00", morning, URLS);
const lines = ics.split("\r\n");
const prop = k => lines.find(l => l.startsWith(k + ":"));

// shape
assert.ok(ics.endsWith("\r\n"), "ends with CRLF");
assert.ok(!/[^\r]\n/.test(ics), "every line break is CRLF, never a bare LF");
assert.equal(lines[0], "BEGIN:VCALENDAR");
for (const k of ["VERSION", "PRODID", "UID", "DTSTAMP", "DTSTART", "RRULE", "SUMMARY"]) assert.ok(prop(k), k + " present");
assert.equal(prop("RRULE"), "RRULE:FREQ=DAILY", "repeats every day");
assert.ok(ics.includes("BEGIN:VALARM") && ics.includes("TRIGGER:PT0M"), "an alert at the event time — the actual reminder");

// time
assert.equal(prop("DTSTART"), "DTSTART:20260924T210000", "later today when the time hasn't passed");
assert.ok(!/Z$/.test(prop("DTSTART")) && !/TZID/.test(prop("DTSTART")),
  "floating local time: 21:00 stays 21:00 wherever the phone is");
assert.match(prop("DTSTAMP"), /^DTSTAMP:\d{8}T\d{6}Z$/, "DTSTAMP is UTC, as the spec requires");
const evening = new Date(2026, 8, 24, 22, 0);
assert.equal(buildIcs("21:00", evening, URLS).split("\r\n").find(l => l.startsWith("DTSTART:")),
  "DTSTART:20260925T210000", "tomorrow when today's time has already gone");
const nye = new Date(2026, 11, 31, 23, 0);
assert.equal(buildIcs("07:00", nye, URLS).split("\r\n").find(l => l.startsWith("DTSTART:")),
  "DTSTART:20270101T070000", "rolls over the year");

// identity: the same time replaces, a different time adds
assert.equal(prop("UID"), "UID:daydesk-reminder-2100@smirsadykov.github.io");
assert.notEqual(buildIcs("08:00", morning, URLS).split("\r\n").find(l => l.startsWith("UID:")), prop("UID"),
  "a morning and an evening reminder can both exist");
assert.match(buildIcs("08:00", morning, URLS), /SUMMARY:День — утро/, "morning wording before noon");
assert.match(ics, /SUMMARY:День — вечерняя отметка/, "evening wording after");

// text escaping and line folding
assert.equal(icsEscape("a,b;c\\d\ne"), "a\\,b\;c\\\\d\\ne", "commas, semicolons, backslashes, newlines");
const long = "DESCRIPTION:" + "Без кальяна, без порно, без лишних трат — ".repeat(4);
const folded = icsFold(long).split("\r\n");
assert.ok(folded.length > 1, "a long line folds");
const enc = new TextEncoder();
assert.ok(folded.every(l => enc.encode(l).length <= 75), "no physical line over 75 octets, even in Cyrillic");
assert.ok(folded.slice(1).every(l => l.startsWith(" ")), "continuation lines start with a space");
assert.equal(folded.map((l, i) => (i ? l.slice(1) : l)).join(""), long, "unfolding gives the original back exactly");
assert.ok(lines.every(l => enc.encode(l).length <= 75), "the whole file respects the limit");

console.log("ics: 21 checks passed");

/* --- payments: parsing, due days, the calendar file --- */
{
  const P = new Function([
    grab(/const iso=[^\n]+/, "iso"), grab(/const parseDate=[^\n]+/, "parseDate"), grab(/const shift=[^\n]+/, "shift"),
    grab(/const icsEscape=[^\n]+/, "icsEscape"), grab(/function icsFold\(line\)\{[\s\S]*?\n\}/, "icsFold"),
    grab(/function parsePayments\(text\)\{[\s\S]*?\n\}/, "parsePayments"), grab(/const dim=[^\n]+/, "dim"),
    grab(/function payDueOn\(p,k\)\{[\s\S]*?\n\}/, "payDueOn"), grab(/function paymentsAround\(list,s,paidOn\)\{[\s\S]*?\n\}/, "paymentsAround"),
    grab(/function buildPaymentsIcs\(list,now,url\)\{[\s\S]*?\n\}/, "buildPaymentsIcs"),
  ].join("\n") + "\nreturn {parsePayments,payDueOn,paymentsAround,buildPaymentsIcs};")();
  const list = P.parsePayments("Интернет 800 ₽ @15\nКАСКО 38000 ₽ @12.03\nАренда @31\nбез даты\nплохо @32");
  assert.deepEqual(list.map(p => [p.title, p.day, p.month]), [["Интернет 800 ₽", 15, null], ["КАСКО 38000 ₽", 12, 3], ["Аренда", 31, null]],
    "monthly, yearly, and lines without a valid date dropped");
  assert.ok(P.payDueOn(list[2], "2026-02-28") && P.payDueOn(list[2], "2026-04-30") && !P.payDueOn(list[2], "2026-04-29"),
    "the 31st falls on the last day of a shorter month");
  assert.ok(P.payDueOn(list[1], "2027-03-12") && !P.payDueOn(list[1], "2027-04-12"), "yearly only in its month");
  const paid = new Set(["2026-09-15|Интернет 800 ₽"]);
  const around = (s) => P.paymentsAround(list, s, (k, t) => paid.has(k + "|" + t)).map(x => x.p.title + " " + x.days + (x.paid ? " paid" : ""));
  assert.deepEqual(around("2026-09-10"), ["Интернет 800 ₽ 5 paid"], "a week ahead, paid shown until its day");
  assert.deepEqual(around("2026-09-20"), [], "paid and past: gone");
  assert.deepEqual(around("2026-10-02"), ["Аренда -2"], "unpaid and past: overdue for a week");
  const ics = P.buildPaymentsIcs(list, new Date(2026, 8, 20, 10), "https://x.example/app/");
  const ev = ics.split("BEGIN:VEVENT").slice(1);
  assert.equal(ev.length, 3, "one event per payment");
  assert.ok(ev[0].includes("DTSTART;VALUE=DATE:20261015") && ev[0].includes("RRULE:FREQ=MONTHLY;BYMONTHDAY=15"), "monthly, next one after today");
  assert.ok(ev[1].includes("DTSTART;VALUE=DATE:20270312") && ev[1].includes("RRULE:FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=12"), "yearly");
  assert.ok(ev[2].includes("DTSTART;VALUE=DATE:20260930") && ev[2].includes("BYMONTHDAY=28,29,30,31;BYSETPOS=-1"), "the 31st: last day of the month");
  assert.ok(ev[0].includes("TRIGGER:-PT15H") && ev[0].includes("TRIGGER:PT9H"), "alerts the evening before and on the day");
  assert.equal(P.buildPaymentsIcs(list, new Date(2026, 8, 21), "https://x.example/app/").match(/UID:[^\r]+/g).join(),
    ics.match(/UID:[^\r]+/g).join(), "the same payment keeps its UID, so exporting again updates it");
  assert.ok(!/[^\r]\n/.test(ics) && ics.endsWith("\r\n"), "CRLF throughout");
  console.log("payments: 12 checks passed");
}
