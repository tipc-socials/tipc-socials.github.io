(function () {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;

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

  function nextFlag(date) {
    const days = Math.round((date - today()) / DAY_MS);
    if (days === 0) return "Next up: tonight";
    if (days === 1) return "Next up: tomorrow";
    if (days < 7) return `Next up: this ${date.toLocaleDateString("en-US", { weekday: "long" })}`;
    return `Next up: in ${days} days`;
  }

  function renderRow(s, isNext) {
    const date = toDate(s.date);
    const upcoming = date >= today();
    const classes = ["row"];
    if (s.skipped) classes.push("is-skipped");
    if (upcoming) classes.push("is-upcoming");
    if (isNext) classes.push("is-next");

    let actions = null;
    if (isNext) {
      actions = el("p", { class: "row-actions" });
      if (safeUrl(s.location)) actions.append(link(s.location, "Directions"));
      if (safeUrl(s.link)) actions.append(link(s.link, "Website"));
      if (!actions.childElementCount) actions = null;
    }

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
        isNext && el("p", { class: "row-flag" }, nextFlag(date)),
        el("p", { class: "row-place" }, s.skipped ? "Skipped" : isNext ? s.place : link(s.link || s.location, s.place)),
        s.notes && el("p", { class: "row-note" }, s.notes),
        actions
      )
    );
  }

  function renderSchedule(socials) {
    const now = today();
    const thisYear = now.getFullYear();
    const next = socials.find((s) => !s.skipped && toDate(s.date) >= now);

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
        const past = rows.filter((s) => toDate(s.date) < now);
        const skipped = past.filter((s) => s.skipped).length;
        const upcoming = rows.length - past.length;
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
          el("ol", { class: "rows" }, ...rows.map((s) => renderRow(s, s === next)))
        );
      })
    );
    if (!years.length) container.append(el("p", { class: "status" }, "Nothing on the schedule yet."));
  }

  function renderStats(socials) {
    const now = today();
    const past = socials.filter((s) => toDate(s.date) < now);
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
    const beenTo = new Set(socials.filter((s) => !s.skipped && toDate(s.date) < now).map((s) => normalize(s.place)));
    const been = (p) => p.visited || beenTo.has(normalize(p.name));

    // Untried spots first.
    const sorted = places.slice().sort((a, b) => been(a) - been(b) || a.name.localeCompare(b.name));

    const list = document.getElementById("places");
    list.replaceChildren(
      ...sorted.map((p) => {
        const notesUrl = safeUrl(p.happy_hour_notes);
        const links = el("div", { class: "place-links" });
        if (safeUrl(p.location)) links.append(link(p.location, "Directions"));
        if (notesUrl) links.append(link(notesUrl, "Happy hour menu"));

        return el(
          "li",
          { class: "place" },
          el("p", { class: "place-name" }, link(p.link, p.name), been(p) && el("span", { class: "place-been" }, "Been there")),
          el("p", { class: "place-hours" }, p.happy_hour ? `Happy hour ${p.happy_hour}` : "Happy hour unknown"),
          !notesUrl && p.happy_hour_notes && el("p", { class: "place-notes" }, p.happy_hour_notes),
          links.childElementCount ? links : null
        );
      })
    );
    if (!sorted.length) list.append(el("li", { class: "place" }, "No places on the list yet."));
  }

  // Click the raccoon to throw again (restart the CSS animation).
  const scene = document.querySelector(".scene");
  scene.addEventListener("click", () => {
    scene.classList.remove("is-playing");
    void scene.offsetWidth;
    scene.classList.add("is-playing");
  });

  fetch("data/socials.json", { cache: "no-cache" })
    .then((res) => {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    })
    .then((data) => {
      renderSchedule(data.socials);
      renderStats(data.socials);
      renderPlaces(data.places || [], data.socials);
    })
    .catch(() => {
      document
        .getElementById("schedule")
        .replaceChildren(el("p", { class: "status error" }, "Couldn't load the schedule. Refresh to try again."));
    });
})();
