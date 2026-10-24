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

  // 24x24 stroke icons (shapes after Lucide's map-pin and martini).
  const ICONS = {
    map: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    menu: '<path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/>',
  };

  function iconLink(url, label, icon) {
    const a = link(url, "", { class: "icon-link", "aria-label": label, title: label });
    a.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" ' +
      `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icon]}</svg>`;
    return a;
  }

  // Map / menu icons that sit at the right end of a row.
  function rowLinks(name, { map, menu } = {}) {
    const links = el("div", { class: "row-links" });
    if (safeUrl(map)) links.append(iconLink(map, `Map: ${name}`, "map"));
    if (safeUrl(menu)) links.append(iconLink(menu, `Happy hour menu: ${name}`, "menu"));
    return links.childElementCount ? links : null;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DAY_MS = 24 * 60 * 60 * 1000;

  const isPast = (s) => toDate(s.date) < today();
  const isVenue = (s) => s.kind === "venue";
  // Rows that are still a social on the calendar (skips and breaks are not).
  const isOn = (s) => s.kind !== "skip" && s.kind !== "break";

  function longDate(date) {
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  function countdown(date) {
    const days = Math.round((date - today()) / DAY_MS);
    if (days <= 0) return "Tonight";
    if (days === 1) return "Tomorrow";
    if (days < 7) return `This ${date.toLocaleDateString("en-US", { weekday: "long" })}`;
    return `In ${days} days`;
  }

  // GIFs load and play only while on screen (rows in collapsed years never
  // load); with reduced motion they stay still until pointed at or focused.
  const gifObserver = new IntersectionObserver((entries) => {
    for (const { target: video, isIntersecting } of entries) {
      if (isIntersecting && !video.src) {
        video.poster = `https://media.giphy.com/media/${video.dataset.gif}/giphy_s.gif`;
        video.src = `https://media.giphy.com/media/${video.dataset.gif}/giphy.mp4`;
      }
      if (reduceMotion) continue;
      if (isIntersecting) playQuietly(video);
      else video.pause();
    }
  });

  function playQuietly(video) {
    // play() rejects if pause() interrupts it; that's expected here.
    const playing = video.play();
    if (playing) playing.catch(() => {});
  }

  // A Giphy GIF as a small looping video; hovering enlarges it.
  function gifThumb(id) {
    if (!/^[A-Za-z0-9]+$/.test(id || "")) return null;
    const a = el("a", {
      class: "gif",
      href: `https://giphy.com/gifs/${id}`,
      target: "_blank",
      rel: "noopener",
      "aria-label": "GIF (opens on Giphy)",
      title: "View on Giphy",
    });
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    video.dataset.gif = id;
    video.setAttribute("aria-hidden", "true");
    if (reduceMotion) {
      const play = () => playQuietly(video);
      const stop = () => video.pause();
      a.addEventListener("mouseenter", play);
      a.addEventListener("focus", play);
      a.addEventListener("mouseleave", stop);
      a.addEventListener("blur", stop);
    }
    a.append(video);
    gifObserver.observe(video);
    return a;
  }

  function placeText(s) {
    const past = isPast(s);
    if (s.kind === "skip") return past ? "Skipped" : "Skipping";
    if (s.kind === "tbd") return past ? "" : "TBD";
    return s.place;
  }

  function renderRow(s, isNext, place) {
    const date = toDate(s.date);
    const classes = ["row"];
    if (!isVenue(s)) classes.push("is-muted");
    if (isNext) classes.push("is-next");

    const website = s.link || (place && place.link);
    const map = s.location || (place && place.location);
    const text = placeText(s);
    const gif = gifThumb(s.gif);

    return el(
      "li",
      { class: classes.join(" ") },
      el(
        "div",
        { class: "row-when" },
        el("time", { class: "row-date", datetime: s.date }, longDate(date)),
        isNext && el("span", { class: "countdown" }, countdown(date))
      ),
      el(
        "div",
        { class: "row-body" },
        text && el("p", { class: "row-place" }, isVenue(s) ? link(website, text, { class: "name" }) : text),
        gif
          ? el("div", { class: "row-detail" }, s.notes && el("p", { class: "row-note" }, s.notes), gif)
          : s.notes && el("p", { class: "row-note" }, s.notes)
      ),
      isVenue(s) ? rowLinks(s.place, { map }) : null
    );
  }

  // Back-to-back break weeks become one band.
  function renderBreak(run) {
    const first = toDate(run[run.length - 1].date);
    const last = toDate(run[0].date);
    const note = (run.find((s) => s.notes) || {}).notes;
    return el(
      "li",
      { class: "row is-break" },
      el(
        "div",
        { class: "row-when" },
        el(
          "time",
          { class: "row-date", datetime: run[run.length - 1].date },
          run.length > 1 ? `${longDate(first)} – ${longDate(last)}` : longDate(first)
        )
      ),
      el("div", { class: "row-body" }, el("p", { class: "row-place" }, "Break"), note && el("p", { class: "row-note" }, note))
    );
  }

  function renderSchedule(socials, places) {
    const now = today();
    const thisYear = now.getFullYear();
    const next = socials.find((s) => isOn(s) && !isPast(s));
    // Fill a row's missing website/map links from the Suggestions tab.
    const placeByName = new Map(places.map((p) => [normalize(p.name), p]));
    // Past rows with nothing in them are just unused placeholders.
    const shown = socials.filter((s) => !(s.kind === "tbd" && isPast(s) && !s.notes));

    const byYear = new Map();
    for (const s of shown) {
      const year = toDate(s.date).getFullYear();
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(s);
    }
    const years = [...byYear.keys()].sort((a, b) => b - a);

    // Open this year plus any year with something coming up; if neither has
    // rows (e.g. early January), open the most recent year instead.
    const open = new Set(years.filter((y) => y === thisYear || byYear.get(y).some((s) => !isPast(s))));
    if (!open.size && years.length) open.add(years[0]);

    const container = document.getElementById("schedule");
    container.replaceChildren(
      ...years.map((year) => {
        const rows = byYear.get(year).slice().sort((a, b) => b.date.localeCompare(a.date));
        const past = rows.filter(isPast);
        const socialsHeld = past.filter(isVenue).length;
        const skipped = past.filter((s) => s.kind === "skip").length;
        const upcoming = rows.filter((s) => !isPast(s) && isOn(s)).length;
        const count = [
          plural(socialsHeld, "social"),
          skipped && `${skipped} skipped`,
          upcoming && `${upcoming} coming up`,
        ]
          .filter(Boolean)
          .join(", ");
        const { mostVisited } = tally(rows);

        const items = [];
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].kind === "break") {
            const run = [rows[i]];
            while (rows[i + 1] && rows[i + 1].kind === "break") run.push(rows[++i]);
            items.push(renderBreak(run));
          } else {
            items.push(renderRow(rows[i], rows[i] === next, placeByName.get(normalize(rows[i].place))));
          }
        }

        return el(
          "details",
          { class: "year", open: open.has(year) },
          el(
            "summary",
            {},
            el("span", { class: "year-label" }, year),
            el(
              "span",
              { class: "year-count" },
              el("span", {}, count),
              mostVisited && el("span", { class: "year-top" }, `Most visited: ${mostVisited}`)
            )
          ),
          el("ol", { class: "rows" }, ...items)
        );
      })
    );
    if (!years.length) container.append(el("p", { class: "status" }, "Nothing on the schedule yet."));
  }

  // Socials held, distinct spots, and the most visited spot (only when some
  // place has been visited more than once; ties go to the most recent).
  function tally(rows) {
    const rounds = rows.filter((s) => isVenue(s) && isPast(s)).sort((a, b) => a.date.localeCompare(b.date));
    const visits = new Map();
    rounds.forEach((s, i) => {
      const v = visits.get(s.place) || { count: 0, last: 0 };
      visits.set(s.place, { count: v.count + 1, last: i });
    });
    const [name, top] = [...visits].sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last)[0] || [];
    return {
      socials: rounds.length,
      spots: visits.size,
      mostVisited: top && top.count > 1 ? `${name} (${top.count} visits)` : null,
    };
  }

  function renderStats(socials) {
    const t = tally(socials);
    const rows = [
      ["Total socials", t.socials],
      ["Different locations", t.spots],
    ];
    if (t.mostVisited) rows.push(["Most visited", t.mostVisited]);
    document
      .getElementById("stats")
      .replaceChildren(...(t.socials ? rows.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, v)]) : []));
  }

  function renderPlaces(places, socials) {
    const beenTo = new Set(socials.filter((s) => isVenue(s) && isPast(s)).map((s) => normalize(s.place)));
    const been = (p) => p.visited || beenTo.has(normalize(p.name));
    const byName = (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

    const item = (p) =>
      el(
        "li",
        { class: "place" },
        el(
          "div",
          { class: "place-body" },
          el("p", { class: "place-name" }, link(p.link, p.name, { class: "name" })),
          el("p", { class: "place-hours" }, p.happy_hour ? `Happy hour ${p.happy_hour}` : "Happy hour unknown"),
          p.happy_hour_notes && el("p", { class: "place-notes" }, p.happy_hour_notes)
        ),
        rowLinks(p.name, { map: p.location, menu: p.happy_hour_menu })
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
