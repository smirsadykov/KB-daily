# «День» (бывший Day Desk)

> Now the «День» tab of Гиря. Everything below about habits, schedules, runs, courses,
> tasks, backup, reminders and sync still applies; the PWA install, service worker and
> update sections are superseded by Гиря's own (see ../README.md). The UI is Russian.

A personal daily dashboard: habits, tasks, training and projects, one day at a time.
Static files, no build step, no dependencies. Installable as a PWA and works offline.

## What's in it

| Block | What it does |
|---|---|
| Affirmation | A standing line across the top of every day |
| Habits | Nested checkboxes, morning and evening sections, per-habit schedules, skippable days |
| Tasks | Written on a day, carried until ticked; every task belongs to a project |
| Workout | Today's items from a weekly plan |
| Projects | Status (Active / On hold / Done), open count, last touched |
| Month | Habit completion and training days at a glance; click a day to open it |

## Habits

One per line in Setup; indent two spaces for a sub-item, and the parent ticks itself
once its sub-items are done.

```
# Morning                   a heading
Read affirmations           every day
Sauna @mon,thu              only those weekdays
Long run @2x                twice a week, any days
Take vitamins @30/30        a course: 30 days on, 30 days off, repeating
  Vitamin D
  Omega-3
# Evening @18               a heading that keeps its habits folded until 18:00
Abstinence @30d             a run: 30 days held without a break
  No hookah                 each sub-item keeps its own run
Gym @mon,wed                a schedule on a parent is inherited by its sub-items
  Squats
  Bench @tue                unless the sub-item sets its own
```

A line starting with `#` is a **section heading**. Give it an hour (`# Evening @18`)
and, on today, the habits under it stay folded into one line until then — whether
an abstinence run held or what got achieved can only be known at the end of the
day, so they shouldn't be tickable at breakfast. Tap the line to open it early; a
past day is always open. Headings are never part of a habit's name, so adding or
moving them doesn't disturb any history.

A habit that isn't wanted today still shows, greyed and out of the count, with the
reason beside it (`mon thu`, `1 left this week`, `break · 27 days left`). Weeks run
Monday to Sunday.

A **run** (`@30d`) is for abstinence: it asks every day and counts the days held
without a break, shown as `day 12 of 30` on the row and, in large type, in the
summary at the top — the hardest commitments get the most visible numbers. One slip and the count starts again;
a day marked **Skip this day** bridges the run instead of ending it. **Tap a count at
the top to log a slip**: after a confirmation it drops to zero on the spot, the time
is kept on the row, and that day can't be ticked as held. Tap it again to undo.
It works on whichever day you're looking at, so a slip you forgot can go on the
right day. Sub-items
inherit the length but each keeps its own count, so breaking one doesn't reset
the others.

A **course** (`@30/30`, or any on/off pair) counts from the first day you ticked it,
so it starts when you actually start. Sub-items share their parent's course — three
vitamins first ticked on three different days still run as one course, off the
earliest of them. To move the start, tick the habit on the day you want it to begin.

**Skip this day** marks a day neutral — ill, travelling. An abstinence run passes
straight through it: it costs nothing and earns nothing.

**Rewording** a habit carries its history with it, as long as you don't add or
remove lines in the same edit. Change the wording, save, then add new habits.

## Tasks

A task belongs to the day you wrote it on and stays on the list every day after
that until you tick it — nothing is stranded on a day you skipped past. Carried
tasks show their age (`5d`) so a stale one is obvious.

Ticking records the day you finished it: that is the day it stops carrying
forward, and the last day it appears on, so it doesn't vanish under your finger.

## Running it

Any static file server. Locally:

```bash
python3 -m http.server 8080
```

Then <http://localhost:8080>. A service worker needs `http://` or `https://` —
opening `index.html` as a `file://` URL works, but without offline caching or install.

## Installing

- **iOS** — open in Safari, Share → *Add to Home Screen*
- **Android / desktop Chrome** — the install prompt in the address bar

## Where the data lives

`localStorage`, in the browser you're using. **Nothing you tick is in this
repository and nothing is sent anywhere** — this repo is the app, not your
history. It works offline, with no account and no server.

Setup → **Backup** exports everything as one JSON file and imports it back. That
is how you move to a new phone, switch browsers, or keep a copy somewhere safe.

The app asks the browser to keep its data even when the device is short of space.
Whether it agrees is the browser's call (installed apps usually get it), and Setup
says which way it went. Once there are a few days of history, a line under the
summary reminds you when this device has never been exported or hasn't been for two
weeks; it stays quiet if sync is set up. The date of the last export belongs to the
device and is never synced — otherwise one backed-up phone would silence the reminder
on another that isn't.

### Reminders

There is no server to send notifications from, and a web page on a phone can't set
an alarm by itself. Setup → **Reminder** writes a daily event, with an alert, into
the phone's own calendar, which does the reminding. It uses local time, so 21:00
stays 21:00 wherever you are; adding the same time again replaces the old event
instead of adding a second. `node test-ics.mjs` checks the file format.

### Optional: syncing across devices

If you'd rather not move a file by hand, Setup → *Sync via GitHub* points the app at
a repository of your own. Every device holding that repository and a token shares one
`data/daydesk.json`, read on load and written a few seconds after any change.

It **must be a private repository — not this public one.** The app checks on every
sync and refuses to write to a public repo, because that file is your whole history.

1. Create a separate **private** repo.
2. Create a **fine-grained personal access token** scoped to that repo only, with
   **Contents: Read and write** and nothing else.
3. Paste the repo (`owner/name`), branch, and token into Setup.

The token is held in that browser's `localStorage`, never in this repository and
never in the page. Treat each device as holding a key to that private repo, and
revoke the token if you lose the device.

**Merging** is per document. The file carries the time each document was last
written; on each sync the newer side wins that document. Two devices editing
different days both survive; two devices editing the *same* day is
last-writer-wins on that day. `node test-merge.mjs` checks this against the
shipped code, as `node test-schedule.mjs` does for schedules. Both read the
functions straight out of `index.html`, so they can't drift from what ships.

Setup → Backup also exports and imports everything as JSON, with no GitHub involved.

The same `index.html` runs as a Claude artifact too, where it uses the artifact's own
store and skips GitHub entirely. It picks whichever is available at load.

## Shipping a change

Edit `index.html`, then bump `CACHE` in `sw.js`. The page is fetched network-first,
so an online device gets the new version on its next open; the cache is only the
offline fallback. Bumping `CACHE` is what refreshes the icons, manifest and fonts,
and a device that picks up a new worker reloads itself once to apply it.

An installed app on a phone usually resumes from memory instead of loading the page,
so on its own it would never ask whether anything changed. It asks every time it comes
back to the foreground, and hourly while it stays open.

**If a device is ever stuck on an old version**, open `reset.html` on it —
<https://smirsadykov.github.io/Habit-Dashboard/reset.html>. It shows what the server
has against what the device is holding, and one button clears the cached app files
and reloads. Your ticks and history are in browser storage, not the cache, and are
not touched. It works no matter which worker is in control, because that path was
never cached.

## Layout

```
index.html              the whole app: markup, styles, logic
manifest.webmanifest    name, icons, standalone display
sw.js                   offline cache for the app shell + fonts
icon-*.png              generated app icons
test-merge.mjs          self-check for the sync merge
test-schedule.mjs       self-check for habit schedules
test-migrate.mjs        self-check for the one-time habit migrations
test-ics.mjs            self-check for the calendar reminder file
test-offline.mjs        opens the app in headless Chrome with the network gone
reset.html              clears a stuck offline copy on a device
data/                   only if you turn sync on, and never in this repo
```
