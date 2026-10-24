(function () {
  "use strict";

  // "2026-10-29" -> local-midnight Date (avoids the UTC off-by-one).
  function toDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function today() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function normalize(name) {
    return name.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  }

  function safeUrl(url) {
    return /^https?:\/\//i.test(url || "") ? url : "";
  }

  // Tiny element builder: el("a", { href, class }, "text", child, ...)
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "class") node.className = value;
      else if (value === true) node.setAttribute(key, "");
      else node.setAttribute(key, value);
    }
    for (const child of children) {
      if (child === null || child === undefined || child === false || child === "") continue;
      node.append(child instanceof Node ? child : String(child));
    }
    return node;
  }

  function link(url, text, attrs) {
    const href = safeUrl(url);
    if (!href) return el("span", attrs, text);
    return el("a", { href, target: "_blank", rel: "noopener", ...attrs }, text);
  }

  function plural(n, word) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  }

  // A place name linked to its website, followed by small Map / Menu links.
  function placeLine(cls, name, { website, map, menu } = {}) {
    const extras = el("span", { class: "extra-links" });
    if (safeUrl(map)) extras.append(link(map, "Map"));
    if (safeUrl(menu)) extras.append(link(menu, "Happy hour menu"));
    return el(
      "p",
      { class: cls },
      link(website, name, { class: "name" }),
      extras.childElementCount ? extras : null
    );
  }

  function renderRow(s, isNext, place) {
    const date = toDate(s.date);
    const classes = ["row"];
    if (s.skipped || s.tbd) classes.push("is-muted");
    if (isNext) classes.push("is-next");

    return el(
      "li",
      { class: classes.join(" ") },
      el(
        "time",
        { class: "row-date", datetime: s.date },
        date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      ),
      el(
        "div",
        { class: "row-body" },
        s.skipped || s.tbd
          ? el("p", { class: "row-place" }, s.skipped ? "Skipped" : "TBD")
          : placeLine("row-place", s.place, {
              website: s.link || (place && place.link),
              map: s.location || (place && place.location),
            }),
        s.notes && el("p", { class: "row-note" }, s.notes)
      )
    );
  }

  function renderSchedule(socials, places) {
    const now = today();
    const thisYear = now.getFullYear();
    // The next social still on the calendar (a TBD date counts; skipped weeks don't).
    const next = socials.find((s) => !s.skipped && toDate(s.date) >= now);
    // Fill a row's missing website/map links from the Suggestions tab.
    const placeByName = new Map(places.map((p) => [normalize(p.name), p]));

    const byYear = new Map();
    for (const s of socials) {
      const year = toDate(s.date).getFullYear();
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(s);
    }
    const years = [...byYear.keys()].sort((a, b) => b - a);

    // Open this year plus any year with something coming up; if neither has
    // rows (e.g. early January), open the most recent year instead.
    const open = new Set(years.filter((y) => y === thisYear || byYear.get(y).some((s) => toDate(s.date) >= now)));
    if (!open.size && years.length) open.add(years[0]);

    const container = document.getElementById("schedule");
    container.replaceChildren(
      ...years.map((year) => {
        const rows = byYear.get(year).slice().sort((a, b) => b.date.localeCompare(a.date));
        const past = rows.filter((s) => toDate(s.date) < now && !s.tbd);
        const skipped = past.filter((s) => s.skipped).length;
        const upcoming = rows.filter((s) => toDate(s.date) >= now).length;
        const count = [
          plural(past.length - skipped, "social"),
          skipped && `${skipped} skipped`,
          upcoming && `${upcoming} coming up`,
        ]
          .filter(Boolean)
          .join(", ");
        return el(
          "details",
          { class: "year", open: open.has(year) },
          el("summary", {}, el("span", { class: "year-label" }, year), el("span", { class: "year-count" }, count)),
          el("ol", { class: "rows" }, ...rows.map((s) => renderRow(s, s === next, placeByName.get(normalize(s.place)))))
        );
      })
    );
    if (!years.length) container.append(el("p", { class: "status" }, "Nothing on the schedule yet."));
  }

  function renderStats(socials) {
    const now = today();
    const past = socials.filter((s) => toDate(s.date) < now && !s.tbd);
    const rounds = past.filter((s) => !s.skipped);

    // Visits per place; ties go to whichever was visited most recently.
    const visits = new Map();
    rounds.forEach((s, i) => {
      const v = visits.get(s.place) || { count: 0, last: 0 };
      visits.set(s.place, { count: v.count + 1, last: i });
    });
    const [regular, top] =
      [...visits].sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last)[0] || [];

    const stat = (n, label) => el("li", {}, el("strong", {}, n), " " + label);
    const stats = [
      stat(rounds.length, rounds.length === 1 ? "social" : "socials"),
      stat(visits.size, visits.size === 1 ? "spot" : "different spots"),
      stat(past.length - rounds.length, "skipped"),
    ];
    if (top && top.count > 1) {
      stats.push(
        el("li", { class: "stat-regular" }, "Our regular: ", el("strong", {}, regular), ` (${top.count} visits)`)
      );
    }
    document.getElementById("stats").replaceChildren(...(rounds.length ? stats : []));
  }

  function renderPlaces(places, socials) {
    const now = today();
    const beenTo = new Set(
      socials.filter((s) => !s.skipped && !s.tbd && toDate(s.date) < now).map((s) => normalize(s.place))
    );
    const been = (p) => p.visited || beenTo.has(normalize(p.name));
    const byName = (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

    const item = (p) =>
      el(
        "li",
        { class: "place" },
        placeLine("place-name", p.name, { website: p.link, map: p.location, menu: p.happy_hour_menu }),
        el("p", { class: "place-hours" }, p.happy_hour ? `Happy hour ${p.happy_hour}` : "Happy hour unknown"),
        p.happy_hour_notes && el("p", { class: "place-notes" }, p.happy_hour_notes)
      );

    const groups = [
      ["Haven't been yet", places.filter((p) => !been(p)).sort(byName)],
      ["Been there", places.filter(been).sort(byName)],
    ].filter(([, rows]) => rows.length);

    const container = document.getElementById("places");
    container.replaceChildren(
      ...groups.flatMap(([title, rows]) => [
        el("h3", { class: "place-group" }, title),
        el("ul", { class: "place-list" }, ...rows.map(item)),
      ])
    );
    if (!groups.length) container.append(el("p", { class: "status" }, "No suggestions yet."));
  }

  fetch("data/socials.json", { cache: "no-cache" })
    .then((res) => {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    })
    .then((data) => {
      renderSchedule(data.socials, data.places || []);
      renderStats(data.socials);
      renderPlaces(data.places || [], data.socials);
    })
    .catch(() => {
      document
        .getElementById("schedule")
        .replaceChildren(el("p", { class: "status error" }, "Couldn't load the schedule. Refresh to try again."));
    });
})();
