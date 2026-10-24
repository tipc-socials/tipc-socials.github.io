# TIPC socials

The website for the weekly TIPC social: **https://tipc-socials.github.io**

It shows the schedule (with the next social highlighted), every week we've
been out, and a list of suggested places. All of it comes from a
[Google Sheet](https://docs.google.com/spreadsheets/d/1bbNUhRT9cgd-hokt4XJx3N_Q7m18bZWIseVWDS8bN7s/edit).

## Updating the site

Edit the Google Sheet. The site picks up changes within about 30–60 minutes.

**Weekly log tab** (`Date, Place, Link, Location, Notes`)

- `Date`: write it like `Oct 29 2026`. `2026-10-29` and `10/29/2026` also work.
- `Place`: the name of the spot, or one of these words:
  - `Skip`: no social that week (past or future). Say why in `Notes`.
  - `Break`: a planned pause, with its name in `Notes` (e.g. `Winter break`).
    Back-to-back `Break` weeks show as one band.
  - `TBD`, or leave it blank: the spot isn't picked yet.
  - Anything with "skip" in it (e.g. `Potential skip`) is shown as written,
    greyed out.
- `Link`: the place's website (optional).
- `Location`: a Google Maps link (optional).
- `Notes`: anything worth remembering (optional). Paste a Giphy link here and
  the GIF shows in the row instead of the link.

The first row dated today or later that isn't a `Skip` or `Break` is
highlighted as the next social, with a countdown. If a row has no `Link` or
`Location`, the site borrows them from the Places tab when the names match.

**Places tab** (`Places, Link, Location, Have we been?, Happy hour times, Happy hour notes, Happy hour menu`)

Shown under "Suggestions", split into "Haven't been yet" and "Been there"
and sorted alphabetically. A place counts as been-there if `Have we been?`
says `Yes` or if it appears in the weekly log. `Happy hour menu` takes a link
to the menu.

Keep the header row as it is. If a column is renamed or a date can't be
read, the sync stops and the site keeps showing the last good version until
the sheet is fixed.

## How it works

```
Google Sheet ──(every 30 min)──> GitHub Action ──> site/data/socials.json ──> GitHub Pages
```

- [`scripts/sync_sheet.py`](scripts/sync_sheet.py) downloads both tabs as CSV,
  checks them, and writes `site/data/socials.json`. It uses only the Python
  standard library.
- [`.github/workflows/sync-sheet.yml`](.github/workflows/sync-sheet.yml) runs
  the script every 30 minutes, commits the JSON when it changes, and deploys
  `site/` to GitHub Pages. It also runs on every push to `main` and can be
  run by hand from the Actions tab ("Run workflow").
- `site/` is a static page: `index.html`, `style.css`, `app.js` (reads the
  JSON), and `raccoon.js` (the header animation). There is no build step.

The git history of `site/data/socials.json` doubles as a backup of the sheet.

## Running locally

```sh
python3 scripts/sync_sheet.py      # refresh site/data/socials.json
cd site && python3 -m http.server  # open http://localhost:8000
```

## Setup notes

- **Settings → Pages → Source** must be set to **GitHub Actions**.
- The sheet must stay shared as "Anyone with the link can view" (or edit).
- If the sync fails, GitHub emails whoever last edited the workflow. The
  failed run's log names the bad row.
