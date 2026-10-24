// The header scene: a raccoon throws darts at a dartboard.
// Drawn as SVG and animated frame by frame so motion can follow real curves
// (anticipation, arcs, follow-through, squash and stretch).
// Throws once when first visible; click to throw again (three darts per turn).
(function () {
  "use strict";

  const scene = document.querySelector(".scene");
  if (!scene) return;
  const svg = scene.querySelector("svg");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Stanford palette, plus fur tones mixed to sit on Cardinal red.
  const C = {
    fur: "#aaa49b",
    furShade: "#837d75",
    furLight: "#f2f0e9",
    ink: "#2e2d29",
    eye: "#121110",
    cream: "#f4eedc",
    red: "#b1040e",
    green: "#175e54",
    steel: "#d5d5d4",
    steelDark: "#8f8d89",
    flight: "#fedd5c",
  };

  const FEET = { x: 110, y: 198 };
  const SHOULDER = { x: 128, y: 124 };
  const NECK = { x: 128, y: 104 };
  const EAR = { x: 140, y: 60 };
  const EYES = [
    { x: 143, y: 79 },
    { x: 118, y: 80 },
  ];
  const UPPER_ARM = 21;
  const FOREARM = 23;
  const GRIP = 15; // paw centre to dart tip
  const BOARD = { x: 398, y: 98, r: 60 };
  const TAIL = {
    base: [88, 178],
    ctrl: [30, 190],
    tip: [36, 114],
    rings: [[0.2, 0.31], [0.42, 0.53], [0.63, 0.73], [0.82, 0.9], [0.96, 1]],
  };
  const MAX_DARTS = 3;

  // ---------- Drawing ----------

  function boardMarkup() {
    const seg = (r) => ((2 * Math.PI * r) / 20).toFixed(3);
    const ring = (r, w) =>
      `<circle r="${r}" fill="none" stroke="${C.red}" stroke-width="${w}"/>` +
      `<circle r="${r}" fill="none" stroke="${C.green}" stroke-width="${w}" stroke-dasharray="${seg(r)} ${seg(r)}"/>`;
    let wires = "";
    for (let i = 0; i < 20; i++) {
      const a = (i * 18 * Math.PI) / 180;
      const p = (r) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
      wires += `<path d="M${p(7.5)} L${p(50)}"/>`;
    }
    return `
      <circle cx="${BOARD.x + 3}" cy="${BOARD.y + 8}" r="${BOARD.r}" fill="#000" opacity=".2"/>
      <g data-r="board">
        <g transform="translate(${BOARD.x} ${BOARD.y}) rotate(-9)">
          <circle r="${BOARD.r}" fill="${C.ink}"/>
          <circle r="25" fill="none" stroke="${C.cream}" stroke-width="50" stroke-dasharray="${seg(25)} ${seg(25)}"/>
          ${ring(47.5, 5)}
          ${ring(29, 5)}
          <circle r="7.5" fill="${C.green}"/>
          <circle r="3.4" fill="${C.red}"/>
          <g fill="none" stroke="#e4e1d8" stroke-opacity=".4" stroke-width=".6">
            <circle r="50"/><circle r="45"/><circle r="31.5"/><circle r="26.5"/><circle r="7.5"/>
            ${wires}
          </g>
        </g>
        <g data-r="stuck"></g>
      </g>`;
  }

  function raccoonMarkup() {
    return `
      <ellipse data-r="shadow" cx="${FEET.x}" cy="${FEET.y + 1}" rx="46" ry="5.5" fill="#000" opacity=".2"/>
      <g data-r="body">
        <g data-r="tail">
          <path data-r="tail-fur" fill="${C.fur}"/>
          ${TAIL.rings.map(() => `<path data-ring fill="${C.ink}"/>`).join("")}
          <circle data-r="tail-tip" fill="${C.ink}"/>
        </g>
        <path d="M86 194 C70 172 72 134 94 114 C106 104 128 103 139 117 C153 140 150 178 136 194 Z" fill="${C.fur}"/>
        <path d="M112 193 C103 172 106 140 122 126 C136 138 141 166 135 193 Z" fill="${C.furLight}"/>
        <ellipse cx="98" cy="196" rx="13" ry="5.5" fill="${C.ink}"/>
        <ellipse cx="133" cy="196" rx="14" ry="5.5" fill="${C.ink}"/>
        <g data-r="head">
          <path d="M106 68 C101 53 107 44 116 46 C122 50 122 60 120 64 Z" fill="${C.furShade}"/>
          <path d="M110 63 C107 55 110 50 115 51 C118 54 118 59 117 61 Z" fill="${C.ink}"/>
          <g data-r="ear">
            <path d="M130 58 C129 44 137 36 146 39 C152 45 150 55 145 60 Z" fill="${C.fur}" stroke="${C.furLight}" stroke-width="2.5" stroke-linejoin="round"/>
            <path d="M135 56 C134 47 139 42 144 44 C147 48 146 54 143 57 Z" fill="${C.ink}"/>
          </g>
          <path d="M100 86 C97 68 111 55 130 55 C148 55 160 67 158 83 C156 97 142 105 128 105 C118 105 109 101 103 96 L95 100 L100 90 Z" fill="${C.fur}"/>
          <path d="M103 88 C110 99 128 104 144 99 C134 93 116 92 103 88 Z" fill="${C.furLight}"/>
          <path d="M101 82 C107 71 122 69 132 75 C138 71 150 71 157 79 C152 87 141 89 133 85 C125 93 109 93 101 82 Z" fill="${C.ink}"/>
          <path d="M105 74 C115 62 140 60 155 73 C142 67 119 67 105 74 Z" fill="${C.furLight}"/>
          <g data-r="eyes-open">
            ${EYES.map(
              (e, i) => `<g data-r="eye${i}">
                <circle cx="${e.x}" cy="${e.y}" r="3.7" fill="${C.eye}" stroke="${C.furShade}" stroke-width=".8"/>
                <circle cx="${e.x + 1.2}" cy="${e.y - 1.3}" r="1.25" fill="#fff"/>
              </g>`
            ).join("")}
          </g>
          <g data-r="eyes-happy" opacity="0" fill="none" stroke="${C.furLight}" stroke-width="1.9" stroke-linecap="round">
            ${EYES.map((e) => `<path d="M${e.x - 3.6} ${e.y + 1} Q${e.x} ${e.y - 3.4} ${e.x + 3.6} ${e.y + 1}"/>`).join("")}
          </g>
          <path d="M148 82 C158 80 170 84 174 90 C170 96 156 98 146 96 Z" fill="${C.furLight}"/>
          <ellipse cx="173" cy="89" rx="4.6" ry="3.6" fill="${C.ink}"/>
          <path d="M160 97 Q164 99.5 168 97" fill="none" stroke="${C.ink}" stroke-width="1.4" stroke-linecap="round"/>
        </g>
        <path data-r="arm" fill="none" stroke="${C.furShade}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
        <g data-r="held"><use href="#rc-dart"/></g>
        <circle data-r="paw" r="6.5" fill="${C.ink}"/>
      </g>`;
  }

  svg.setAttribute("viewBox", "0 0 480 220");
  svg.innerHTML = `
    <defs>
      <g id="rc-dart">
        <path d="M0 0 L-10 -1.4 L-10 1.4 Z" fill="${C.steel}"/>
        <rect x="-23" y="-3" width="13.5" height="6" rx="2.6" fill="${C.steel}"/>
        <path d="M-20 -3 V3 M-17 -3 V3 M-14 -3 V3" stroke="${C.steelDark}" stroke-width=".8"/>
        <rect x="-35" y="-1.3" width="12.5" height="2.6" rx="1" fill="${C.ink}"/>
        <path d="M-31 -1 L-41 -10 L-47 -10 L-43 -1 Z M-31 1 L-41 10 L-47 10 L-43 1 Z" fill="${C.flight}"/>
      </g>
    </defs>
    ${boardMarkup()}
    ${raccoonMarkup()}
    <path data-r="trail" fill="none" stroke="${C.furLight}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="0.01 8" opacity="0"/>
    <g data-r="fly" opacity="0"><use href="#rc-dart"/></g>
    <circle data-r="ring" fill="none" stroke="${C.furLight}" stroke-width="1.6" opacity="0"/>`;

  const $ = (name) => svg.querySelector(`[data-r="${name}"]`);
  const el = {
    body: $("body"),
    shadow: $("shadow"),
    head: $("head"),
    ear: $("ear"),
    eyes: [$("eye0"), $("eye1")],
    eyesOpen: $("eyes-open"),
    eyesHappy: $("eyes-happy"),
    arm: $("arm"),
    paw: $("paw"),
    held: $("held"),
    board: $("board"),
    stuck: $("stuck"),
    trail: $("trail"),
    fly: $("fly"),
    ring: $("ring"),
    tailFur: $("tail-fur"),
    tailTip: $("tail-tip"),
    tailRings: [...svg.querySelectorAll("[data-ring]")],
  };

  // ---------- Timeline ----------

  const ease = {
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    out: (x) => 1 - Math.pow(1 - x, 3),
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inQuad: (x) => x * x,
  };

  // track([[t, v], [t, v, ease], ...]): the ease shapes the segment arriving at that key.
  function track(keys) {
    return (t) => {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++) {
        const [t1, v1, e = ease.inOut] = keys[i];
        if (t <= t1) {
          const [t0, v0] = keys[i - 1];
          return v0 + (v1 - v0) * e((t - t0) / (t1 - t0));
        }
      }
      return keys[keys.length - 1][1];
    };
  }

  const RELEASE = 1070;
  const FLIGHT = 520;
  const IMPACT = RELEASE + FLIGHT;
  const END = 2800;

  const T = {
    upper: track([[0, 75], [380, -20], [950, -20], [RELEASE, -16, ease.inQuad], [1300, 6, ease.out], [2000, 75]]),
    fore: track([[0, 95], [380, -80], [650, -84], [950, -128], [RELEASE, -22, ease.inQuad], [1300, 14, ease.out], [2000, 95]]),
    dart: track([[0, -70], [380, -12], [950, -16], [RELEASE, -24, ease.inQuad]]),
    lean: track([[0, 0], [350, -1.5], [650, -1.5], [950, -5], [RELEASE, 3, ease.inQuad], [1300, 5, ease.out], [1950, 0]]),
    head: track([[0, 0], [350, -4], [950, -7], [RELEASE, 1, ease.inQuad], [1950, 0]]),
    tail: track([[0, 0], [950, 12], [1150, -14, ease.out], [1600, 5], [2100, 0]]),
    hop: track([[0, 0], [1860, 0], [2050, -20, ease.outQuad], [2240, 0, ease.inQuad]]),
    squash: track([
      [0, 1], [1780, 1], [1860, 0.9, ease.outQuad], [1930, 1.07, ease.outQuad], [2050, 1],
      [2210, 1.04, ease.inQuad], [2250, 0.92, ease.outQuad], [2340, 1.03], [2440, 1],
    ]),
    held: track([[0, 0], [120, 0], [340, 1], [RELEASE - 1, 1], [RELEASE, 0]]),
  };

  function pose(t) {
    const p = {};
    for (const k in T) p[k] = T[k](t);
    p.happy = t > 1680 && t < 2750;
    return p;
  }

  function armPoints(p) {
    const r = Math.PI / 180;
    const elbow = {
      x: SHOULDER.x + UPPER_ARM * Math.cos(p.upper * r),
      y: SHOULDER.y + UPPER_ARM * Math.sin(p.upper * r),
    };
    const paw = { x: elbow.x + FOREARM * Math.cos(p.fore * r), y: elbow.y + FOREARM * Math.sin(p.fore * r) };
    const tip = { x: paw.x + GRIP * Math.cos(p.dart * r), y: paw.y + GRIP * Math.sin(p.dart * r) };
    return { elbow, paw, tip };
  }

  function bodyMatrix(p) {
    const sx = 1 / Math.sqrt(p.squash);
    return new DOMMatrix()
      .translate(FEET.x, FEET.y + p.hop)
      .rotate(p.lean)
      .scale(sx, p.squash)
      .translate(-FEET.x, -FEET.y);
  }

  const lerp = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
  const deg = (v) => (Math.atan2(v.y, v.x) * 180) / Math.PI;

  // ---------- State ----------

  let throwAt = null;
  let flight = null; // { p0, p1, p2 }
  let impactAt = -Infinity;
  let landed = true;
  let latest = null; // { node, x, y, angle } of the most recent stuck dart
  let nextBlink = 0;
  let blinkAt = -Infinity;
  let nextTwitch = 0;
  let twitchAt = -Infinity;
  let visible = false;
  let looping = false;

  function gauss() {
    return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  }

  function planFlight() {
    const p = pose(RELEASE);
    const start = bodyMatrix(p).transformPoint(new DOMPoint(armPoints(p).tip.x, armPoints(p).tip.y));
    const r = Math.min(40, Math.abs(gauss()) * 13);
    const a = Math.random() * 2 * Math.PI;
    const p0 = { x: start.x, y: start.y };
    const p2 = { x: BOARD.x + r * Math.cos(a), y: BOARD.y + r * Math.sin(a) };
    const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - 58 };
    return { p0, p1, p2 };
  }

  function stickDart(x, y, angle) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "use");
    node.setAttribute("href", "#rc-dart");
    el.stuck.append(node);
    latest = { node, x, y, angle };
    setStuck(latest, angle);
  }

  function setStuck(d, angle) {
    d.node.setAttribute("transform", `translate(${d.x} ${d.y}) rotate(${angle}) scale(0.62 1)`);
  }

  function clearBoard(then) {
    el.stuck.style.transition = "opacity 0.3s ease";
    el.stuck.style.opacity = "0";
    setTimeout(() => {
      el.stuck.replaceChildren();
      el.stuck.style.opacity = "1";
      latest = null;
      then();
    }, 320);
  }

  function startThrow() {
    flight = planFlight();
    landed = false;
    throwAt = performance.now();
    loop();
  }

  function throwDart() {
    if (reduceMotion) {
      const place = () => {
        const f = planFlight();
        const end = { x: 2 * (f.p2.x - f.p1.x), y: 2 * (f.p2.y - f.p1.y) };
        stickDart(f.p2.x, f.p2.y, deg(end));
      };
      if (el.stuck.childElementCount >= MAX_DARTS) clearBoard(place);
      else place();
      return;
    }
    if (throwAt !== null) return;
    if (el.stuck.childElementCount >= MAX_DARTS) clearBoard(startThrow);
    else startThrow();
  }

  // ---------- Rendering ----------

  function render(now) {
    const t = throwAt === null ? Infinity : now - throwAt;
    const p = pose(t);
    const idle = reduceMotion ? 0 : 1;

    // Breathing and squash/stretch on the whole body, pivoting at the feet.
    const breath = idle * Math.sin((now / 3400) * 2 * Math.PI);
    const sy = p.squash * (1 + 0.012 * breath);
    const sx = (1 / Math.sqrt(p.squash)) * (1 - 0.006 * breath);
    el.body.setAttribute(
      "transform",
      `translate(${FEET.x} ${FEET.y + p.hop}) rotate(${p.lean}) scale(${sx} ${sy}) translate(${-FEET.x} ${-FEET.y})`
    );
    const k = 1 + p.hop / 70;
    el.shadow.setAttribute("transform", `translate(${FEET.x} ${FEET.y}) scale(${k} 1) translate(${-FEET.x} ${-FEET.y})`);
    el.shadow.setAttribute("opacity", (0.2 * (1 + p.hop / 60)).toFixed(3));

    el.head.setAttribute("transform", `rotate(${p.head + 0.8 * breath} ${NECK.x} ${NECK.y})`);

    // Ear: occasional twitch, and it lags behind hops.
    if (idle && now >= nextTwitch) {
      twitchAt = now;
      nextTwitch = now + 4500 + Math.random() * 5000;
    }
    const tw = (now - twitchAt) / 260;
    const twitch = tw >= 0 && tw < 1 ? -16 * Math.sin(Math.PI * tw) : 0;
    el.ear.setAttribute("transform", `rotate(${twitch + (1 - p.squash) * 80} ${EAR.x} ${EAR.y})`);

    // Eyes: blink now and then; close happily after a hit.
    if (idle && now >= nextBlink) {
      blinkAt = now;
      nextBlink = now + 2600 + Math.random() * 4000;
    }
    const bl = (now - blinkAt) / 170;
    const lid = bl >= 0 && bl < 1 ? 1 - 0.9 * Math.sin(Math.PI * bl) : 1;
    EYES.forEach((e, i) =>
      el.eyes[i].setAttribute("transform", `translate(${e.x} ${e.y}) scale(1 ${lid}) translate(${-e.x} ${-e.y})`)
    );
    el.eyesOpen.setAttribute("opacity", p.happy ? 0 : 1);
    el.eyesHappy.setAttribute("opacity", p.happy ? 1 : 0);

    // Arm and the dart in the paw.
    const arm = armPoints(p);
    el.arm.setAttribute("d", `M${SHOULDER.x} ${SHOULDER.y} L${arm.elbow.x} ${arm.elbow.y} L${arm.paw.x} ${arm.paw.y}`);
    el.paw.setAttribute("cx", arm.paw.x);
    el.paw.setAttribute("cy", arm.paw.y);
    el.held.setAttribute("transform", `translate(${arm.tip.x} ${arm.tip.y}) rotate(${p.dart}) scale(${0.85 + 0.15 * p.held})`);
    el.held.setAttribute("opacity", p.held.toFixed(3));

    // Tail: beads along a curve that swings from the base.
    const swing = ((p.tail + idle * 5 * Math.sin(now / 1900) - p.hop * 0.8) * Math.PI) / 180;
    const [bx, by] = TAIL.base;
    const rot = ([x, y], a) => ({
      x: bx + (x - bx) * Math.cos(a) - (y - by) * Math.sin(a),
      y: by + (x - bx) * Math.sin(a) + (y - by) * Math.cos(a),
    });
    const b0 = { x: bx, y: by };
    const b1 = rot(TAIL.ctrl, swing * 0.5);
    const b2 = rot(TAIL.tip, swing);
    // Edge point of the tail tube at s (0 = base, 1 = tip) on one side.
    const edge = (s, side) => {
      const c = lerp(lerp(b0, b1, s), lerp(b1, b2, s), s);
      const d = { x: (1 - s) * (b1.x - b0.x) + s * (b2.x - b1.x), y: (1 - s) * (b1.y - b0.y) + s * (b2.y - b1.y) };
      const len = Math.hypot(d.x, d.y);
      const r = 10.5 - 4.5 * s + 3.5 * Math.sin(Math.PI * s);
      return { x: c.x - (side * r * d.y) / len, y: c.y + (side * r * d.x) / len, c, r };
    };
    const band = (s0, s1, steps) => {
      const left = [];
      const right = [];
      for (let i = 0; i <= steps; i++) {
        const s = s0 + ((s1 - s0) * i) / steps;
        left.push(edge(s, 1));
        right.push(edge(s, -1));
      }
      const pts = left.concat(right.reverse());
      return "M" + pts.map((q) => `${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(" L") + " Z";
    };
    el.tailFur.setAttribute("d", band(0, 1, 24));
    TAIL.rings.forEach(([s0, s1], i) => el.tailRings[i].setAttribute("d", band(s0, s1, 4)));
    const tip = edge(1, 1);
    el.tailTip.setAttribute("cx", tip.c.x.toFixed(2));
    el.tailTip.setAttribute("cy", tip.c.y.toFixed(2));
    el.tailTip.setAttribute("r", tip.r.toFixed(2));

    // Dart in flight: follows the curve and turns to face its direction.
    if (flight && t >= RELEASE && t < IMPACT) {
      const u = (t - RELEASE) / FLIGHT;
      const uu = 0.8 * u + 0.2 * ease.outQuad(u);
      const { p0, p1, p2 } = flight;
      const a = lerp(p0, p1, uu);
      const pos = lerp(a, lerp(p1, p2, uu), uu);
      const tangent = { x: (1 - uu) * (p1.x - p0.x) + uu * (p2.x - p1.x), y: (1 - uu) * (p1.y - p0.y) + uu * (p2.y - p1.y) };
      const fore = 1 - 0.38 * Math.max(0, Math.min(1, (u - 0.7) / 0.3)) ** 2;
      el.fly.setAttribute("transform", `translate(${pos.x} ${pos.y}) rotate(${deg(tangent)}) scale(${fore} 1)`);
      el.fly.setAttribute("opacity", 1);
      el.trail.setAttribute("d", `M${p0.x} ${p0.y} Q${a.x} ${a.y} ${pos.x} ${pos.y}`);
      el.trail.setAttribute("opacity", 0.55);
    }
    if (flight && !landed && t >= IMPACT) {
      landed = true;
      impactAt = throwAt + IMPACT;
      el.fly.setAttribute("opacity", 0);
      const { p1, p2 } = flight;
      el.trail.setAttribute("d", `M${flight.p0.x} ${flight.p0.y} Q${p1.x} ${p1.y} ${p2.x} ${p2.y}`);
      stickDart(p2.x, p2.y, deg({ x: p2.x - p1.x, y: p2.y - p1.y }));
    }

    // Impact: the dart quivers, the board gives a little, a ring spreads out.
    const dt = now - impactAt;
    if (dt >= 0 && dt < 1100) {
      el.trail.setAttribute("opacity", Math.max(0, 0.55 * (1 - dt / 700)).toFixed(3));
      const shake = 2.6 * Math.exp(-dt / 70) * Math.sin(dt / 14);
      el.board.setAttribute("transform", `translate(${shake.toFixed(2)} 0)`);
      if (latest) setStuck(latest, latest.angle + 7 * Math.exp(-dt / 150) * Math.sin(dt / 19));
      const rp = Math.min(1, dt / 520);
      el.ring.setAttribute("cx", flight.p2.x);
      el.ring.setAttribute("cy", flight.p2.y);
      el.ring.setAttribute("r", (4 + 26 * ease.out(rp)).toFixed(2));
      el.ring.setAttribute("opacity", (0.7 * (1 - rp)).toFixed(3));
    }

    if (throwAt !== null && t > END) throwAt = null;
  }

  function loop() {
    if (looping || reduceMotion) return;
    looping = true;
    const step = (now) => {
      if (!visible && throwAt === null) {
        looping = false;
        return;
      }
      render(now);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  scene.addEventListener("click", throwDart);

  render(0);
  if (reduceMotion) {
    throwDart();
    return;
  }

  let thrownOnce = false;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) return;
    loop();
    if (!thrownOnce) {
      thrownOnce = true;
      setTimeout(throwDart, 600);
    }
  }).observe(scene);
})();
