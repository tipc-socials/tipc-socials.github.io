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

  function fmt(date, opts) {
    return date.toLocaleDateString("en-US", opts);
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
      else node.setAttribute(key, value);
    }
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : String(child));
    }
    return node;
  }

  function link(url, text, attrs) {
    const href = safeUrl(url);
    if (!href) return el("span", attrs, text);
    return el("a", { href, target: "_blank", rel: "noopener", ...attrs }, text);
  }

  function whenPhrase(date) {
    const days = Math.round((date - today()) / DAY_MS);
    const full = fmt(date, { weekday: "long", month: "long", day: "numeric" });
    if (days === 0) return [el("span", { class: "soon" }, "Tonight"), ", " + full];
    if (days === 1) return [el("span", { class: "soon" }, "Tomorrow"), ", " + full];
    if (days < 7) return ["This " + full];
    return [full];
  }

  function renderNext(socials) {
    const section = document.getElementById("next");
    const now = today();
    const upcoming = socials.filter((s) => !s.skipped && toDate(s.date) >= now);
    const past = socials.filter((s) => !s.skipped && toDate(s.date) < now);
    section.replaceChildren();

    if (!upcoming.length) {
      const last = past[past.length - 1];
      section.append(
        el("p", { class: "next-when" }, "This week"),
        el("h1", { class: "next-place is-tbd" }, "Spot not picked yet"),
        last &&
          el(
            "p",
            { class: "next-notes" },
            `Last time we were at ${last.place} on ${fmt(toDate(last.date), { month: "long", day: "numeric" })}.`
          )
      );
      return;
    }

    const next = upcoming[0];
    const actions = el("div", { class: "next-actions" });
    if (safeUrl(next.location)) {
      actions.append(link(next.location, "Get directions", { class: "button primary" }));
    }
    if (safeUrl(next.link)) {
      actions.append(link(next.link, "Visit website", { class: "button" }));
    }

    section.append(
      el("p", { class: "next-when" }, ...whenPhrase(toDate(next.date))),
      el("h1", { class: "next-place" }, next.place),
      next.notes && el("p", { class: "next-notes" }, next.notes),
      actions.childElementCount ? actions : null
    );

    const later = upcoming.slice(1);
    if (later.length) {
      section.append(
        el(
          "ul",
          { class: "also", "aria-label": "Also coming up" },
          ...later.map((s) =>
            el(
              "li",
              {},
              fmt(toDate(s.date), { weekday: "short", month: "short", day: "numeric" }) + ": ",
              el("strong", {}, s.place)
            )
          )
        )
      );
    }
  }

  function renderTab(socials) {
    const now = today();
    const past = socials.filter((s) => toDate(s.date) < now).reverse();
    const list = document.getElementById("history");

    list.replaceChildren(
      ...past.map((s) => {
        const date = toDate(s.date);
        const showYear = date.getFullYear() !== now.getFullYear();
        const label = fmt(date, { month: "short", day: "numeric", ...(showYear && { year: "2-digit" }) });
        return el(
          "li",
          { class: "line" + (s.skipped ? " is-skipped" : "") },
          el(
            "div",
            { class: "line-main" },
            el("time", { class: "line-date", datetime: s.date }, label),
            el("span", { class: "line-place" }, s.skipped ? "Skipped" : link(s.link || s.location, s.place))
          ),
          s.notes && el("p", { class: "line-note" }, s.notes)
        );
      })
    );
    if (!past.length) list.append(el("li", { class: "line" }, "Nothing on the tab yet."));

    const rounds = past.filter((s) => !s.skipped);
    const counts = new Map();
    for (const s of rounds) counts.set(s.place, (counts.get(s.place) || 0) + 1);
    const [regular, regularCount] = [...counts].sort((a, b) => b[1] - a[1])[0] || [];

    const totals = [
      ["Rounds", rounds.length],
      ["Places", counts.size],
      ["Skipped", past.length - rounds.length],
    ];
    if (regularCount > 1) totals.push(["Regular", `${regular} ×${regularCount}`]);

    document
      .getElementById("totals")
      .replaceChildren(...totals.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, v)]));
  }

  function renderPlaces(places, socials) {
    const now = today();
    const beenTo = new Set(
      socials.filter((s) => !s.skipped && toDate(s.date) < now).map((s) => normalize(s.place))
    );

    const item = (p) => {
      const hoursText = p.happy_hour ? `Happy hour ${p.happy_hour}` : "Happy hour unknown";
      const notesUrl = safeUrl(p.happy_hour_notes);
      const meta = [];
      if (safeUrl(p.location)) meta.push(link(p.location, "Directions"));
      if (notesUrl) meta.push(link(notesUrl, "Happy hour menu"));
      else if (p.happy_hour_notes) meta.push(el("span", {}, p.happy_hour_notes));

      return el(
        "li",
        { class: "item" },
        el(
          "div",
          { class: "item-row" },
          link(p.link, p.name, { class: "item-name" }),
          el("span", { class: "item-leader", "aria-hidden": "true" }),
          el("span", { class: "item-hours" + (p.happy_hour ? "" : " is-empty") }, hoursText)
        ),
        meta.length > 0 &&
          el("p", { class: "item-meta" }, ...meta)
      );
    };

    const been = places.filter((p) => p.visited || beenTo.has(normalize(p.name)));
    const fresh = places.filter((p) => !been.includes(p));

    const fill = (id, rows, empty) => {
      const ul = document.getElementById(id);
      ul.replaceChildren(...rows.map(item));
      if (!rows.length) ul.append(el("li", { class: "item item-meta" }, empty));
    };
    fill("places-new", fresh, "We've been everywhere on the list. Add more to the sheet.");
    fill("places-been", been, "Nowhere yet.");
  }

  fetch("data/socials.json", { cache: "no-cache" })
    .then((res) => {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    })
    .then((data) => {
      renderNext(data.socials);
      renderTab(data.socials);
      renderPlaces(data.places || [], data.socials);
    })
    .catch(() => {
      document
        .getElementById("next")
        .replaceChildren(
          el("p", { class: "next-when error" }, "Couldn't load the socials list. Refresh to try again.")
        );
    });
})();
