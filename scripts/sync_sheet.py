#!/usr/bin/env python3
"""Download the socials Google Sheet and write it to site/data/socials.json.

The sheet has two tabs:
  - the weekly log:  Date, Place, Link, Location, Notes
  - the places list: Places, Link, Location, Have we been?, Happy hour times, Happy hour notes

Exits non-zero (and writes nothing) if either tab can't be fetched or doesn't
look right, so a bad edit never blanks the website.

Usage:
    python3 scripts/sync_sheet.py
"""

import csv
import io
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

SHEET_ID = "1bbNUhRT9cgd-hokt4XJx3N_Q7m18bZWIseVWDS8bN7s"
SOCIALS_GID = "985458345"
PLACES_GID = "0"
OUT_PATH = Path(__file__).resolve().parent.parent / "site" / "data" / "socials.json"

# Formats people are likely to type (or Sheets is likely to export).
DATE_FORMATS = [
    "%b %d %Y",  # Jan 14 2026
    "%B %d %Y",  # January 14 2026
    "%b %d, %Y",  # Jan 14, 2026
    "%B %d, %Y",  # January 14, 2026
    "%Y-%m-%d",  # 2026-01-14
    "%m/%d/%Y",  # 1/14/2026
]


class SheetError(Exception):
    pass


def fetch_csv(gid):
    url = (
        f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "tipc-socials-sync"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        text = resp.read().decode("utf-8-sig")
    if "<html" in text[:500].lower():
        raise SheetError(
            f"Got a web page instead of CSV for tab gid={gid}. Is the sheet still "
            "shared as 'Anyone with the link'?"
        )
    return text


def read_table(text, tab_name, required, optional):
    """Yield (row_number, get) for each non-blank row; get(col) returns a stripped cell."""
    reader = csv.reader(io.StringIO(text))
    header = next(reader, None)
    if header is None:
        raise SheetError(f"The {tab_name} tab is empty.")

    columns = [h.strip().lower() for h in header]
    missing = [c for c in required if c not in columns]
    if missing:
        raise SheetError(
            f"The {tab_name} tab is missing column(s) {missing}. Found: {header}"
        )
    index = {c: columns.index(c) for c in required + optional if c in columns}

    for row_num, raw in enumerate(reader, start=2):
        if not any(cell.strip() for cell in raw):
            continue

        def get(col, raw=raw):
            i = index.get(col)
            return raw[i].strip() if i is not None and i < len(raw) else ""

        yield row_num, get


def parse_date(value):
    cleaned = " ".join(value.replace(".", "").split())
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def clean_url(value):
    """Keep only http(s) links so nothing odd ends up in an href."""
    value = value.strip()
    if value.lower().startswith(("http://", "https://")):
        return value
    if value and "." in value and " " not in value:
        return "https://" + value
    return ""


def parse_socials(text):
    rows, errors = [], []
    for row_num, get in read_table(
        text, "weekly log", ["date", "place"], ["link", "location", "notes"]
    ):
        date = parse_date(get("date"))
        if date is None:
            errors.append(
                f"Weekly log row {row_num}: can't read date '{get('date')}' "
                "(write it like 'Jan 14 2026')"
            )
            continue
        place = get("place")
        if not place:
            errors.append(f"Weekly log row {row_num}: 'Place' is empty")
            continue
        rows.append(
            {
                "date": date.isoformat(),
                "place": place,
                "link": clean_url(get("link")),
                "location": clean_url(get("location")),
                "notes": get("notes"),
                "skipped": place.lower() == "skipped",
            }
        )

    if errors:
        raise SheetError("\n".join(errors))
    if not rows:
        raise SheetError("The weekly log tab has no rows.")
    rows.sort(key=lambda r: r["date"])
    return rows


def parse_places(text):
    rows = []
    optional = [
        "link",
        "location",
        "have we been?",
        "happy hour times",
        "happy hour notes",
    ]
    for _, get in read_table(text, "places", ["places"], optional):
        if not get("places"):
            continue
        rows.append(
            {
                "name": get("places"),
                "link": clean_url(get("link")),
                "location": clean_url(get("location")),
                "visited": get("have we been?").lower().startswith("y"),
                "happy_hour": get("happy hour times"),
                "happy_hour_notes": get("happy hour notes"),
            }
        )
    rows.sort(key=lambda r: r["name"].lower())
    return rows


def main():
    try:
        socials = parse_socials(fetch_csv(SOCIALS_GID))
        places = parse_places(fetch_csv(PLACES_GID))
    except Exception as exc:  # noqa: BLE001 - report anything clearly in the Action log
        for line in str(exc).splitlines():
            print(f"::error::Sheet sync failed: {line}")
        sys.exit(1)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = {"socials": socials, "places": places}
    OUT_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(socials)} socials and {len(places)} places to {OUT_PATH}")


if __name__ == "__main__":
    main()
