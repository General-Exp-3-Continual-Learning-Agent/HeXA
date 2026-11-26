/* Animated version of the HExA overview figure (Figure 1).
   (a) ReAct: independent episodes, no learning.
   (b) HExA: R meta-episodes (rounds) of X inner episodes; after each meta-episode the evolver distils
       trajectories into the skill bank K_n, which is injected into every episode of the next meta-episode.
   (c) Banks from K tasks are synthesised into B_syn for an unseen target task, with no target trajectories.
   Falls back to the static PNG without JS or with prefers-reduced-motion. */
(function () {
  const host = document.getElementById("teaser-anim");
  const img = document.getElementById("teaser-static");
  const btnPlay = document.getElementById("teaser-play");
  const btnView = document.getElementById("teaser-view");
  if (!host || !img) return;

  const NS = "http://www.w3.org/2000/svg";
  const C = 24, G = 6, P = 6;                 // cell size, gap, strip padding
  const KINDS = ["state", "tool", "sim", "tool", "other", "tool"];
  let svg, timers = [], playing = true, runId = 0;

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    (parent || svg).appendChild(e);
    return e;
  }

  // ---------- drawing primitives ----------
  function cell(g, x, y, kind, cls) {
    const c = el("g", { class: "tz-cell " + (cls || ""), transform: `translate(${x},${y})` }, g);
    const st = {
      state: { fill: "#a9dbe3", stroke: "#2b8a9a" }, tool: { fill: "url(#tz-hatch)", stroke: "#8a8a8a" },
      sim: { fill: "#fdd6aa", stroke: "#e8963a" }, other: { fill: "#fff", stroke: "#9a9a9a", "stroke-dasharray": "3 2" },
      ok: { fill: "#fff", stroke: "#3a9a3a" }, bad: { fill: "#fff", stroke: "#d33" }, distill: { fill: "#f7b8cf", stroke: "#d6457f" },
    }[kind];
    el("rect", Object.assign({ width: C, height: C, rx: 4, "stroke-width": 1.6 }, st), c);
    if (kind === "ok") el("path", { d: "M6 12.5l4.5 4.5L18.5 8", fill: "none", stroke: "#3a9a3a", "stroke-width": 2.4, "stroke-linecap": "round" }, c);
    if (kind === "bad") el("path", { d: "M7.5 7.5l9 9M16.5 7.5l-9 9", stroke: "#d33", "stroke-width": 2.4, "stroke-linecap": "round" }, c);
    return c;
  }
  function qbox(g, x, y) {
    const q = el("g", { class: "tz-q", transform: `translate(${x},${y})` }, g);
    el("rect", { width: C, height: C, rx: 4, fill: "#fff", stroke: "#555", "stroke-width": 1.6 }, q);
    el("text", { x: C / 2, y: C / 2 + 5, "text-anchor": "middle", class: "tz-t13" }, q, "Q");
    const chip = el("rect", { class: "tz-chip", x: C - 9, y: -5, width: 11, height: 11, rx: 3, fill: "#f7b8cf", stroke: "#d6457f", "stroke-width": 1.2 }, q);
    return { q, chip };
  }
  // an episode strip: Q + framed cells (+ optional outcome); returns handles
  function strip(g, x, y, outcome, scale, noSkills) {
    const s = el("g", { transform: `translate(${x},${y}) scale(${scale || 1})` }, g);
    const chip = qbox(s, 0, 0).chip;
    if (noSkills) chip.setAttribute("class", "tz-nochip");
    const n = KINDS.length + (outcome ? 1 : 0);
    const w = 2 * P + n * C + (n - 1) * G;
    el("rect", { x: 32, y: -P, width: w, height: C + 2 * P, rx: 5, fill: "none", stroke: "#3b3b98", "stroke-width": 2 }, s);
    const cells = KINDS.map((k, i) => cell(s, 32 + P + i * (C + G), 0, k));
    if (outcome) cells.push(cell(s, 32 + P + KINDS.length * (C + G), 0, outcome));
    return { g: s, cells, chip, width: 32 + w };
  }
  function arrow(x1, y1, x2, y2, cls) {
    return el("line", { x1, y1, x2, y2, class: "tz-arrow " + (cls || ""), "marker-end": "url(#tz-head)" });
  }
  function rich(t, str) {           // render a_{x}, b^{y} as sub/superscript tspans
    t.textContent = "";
    const re = /([_^])(\{[^}]*\}|.)/g; let last = 0, m;
    const put = (txt, shift) => {
      if (!txt) return;
      const sp = el("tspan", shift ? { dy: shift, class: "tz-sub" } : {}, t, txt);
      if (shift) el("tspan", { dy: -shift }, t, "\u200b");
      return sp;
    };
    while ((m = re.exec(str))) {
      put(str.slice(last, m.index), 0);
      put(m[2].replace(/^\{|\}$/g, ""), m[1] === "_" ? 4 : -6);
      last = re.lastIndex;
    }
    put(str.slice(last), 0);
    return t;
  }
  function label(x, y, t, cls, anchor) {
    return rich(el("text", { x, y, class: cls || "tz-t14", "text-anchor": anchor || "middle" }), t);
  }

  // ---------- build the scene ----------
  const S = {};
  function build() {
    host.innerHTML = "";
    svg = el("svg", { viewBox: "0 0 1200 600", class: "tz-svg", role: "img",
      "aria-label": "Animated overview of HExA: ReAct episodes, HExA meta-episodes building a skill bank, and cross-task skill transfer" }, host);
    const defs = el("defs", {});
    const pat = el("pattern", { id: "tz-hatch", width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    el("rect", { width: 5, height: 5, fill: "#d9d9d9" }, pat);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 5, stroke: "#9a9a9a", "stroke-width": 2 }, pat);
    const mk = el("marker", { id: "tz-head", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0 0L10 5L0 10z", fill: "#222" }, mk);

    // ---- (a) ReAct ----
    S.a = el("g", { class: "tz-panel" });
    label(170, 22, "Seed 1", "tz-t14"); label(462, 22, "Seed N", "tz-t14");
    S.aStrips = [strip(S.a, 40, 34, "bad", 1, true), strip(S.a, 332, 34, "bad", 1, true)];
    el("text", { x: 300, y: 52, class: "tz-t16", "text-anchor": "middle" }, S.a, "···");
    S.aTitle = label(310, 92, "(a) ReAct: every episode starts from scratch", "tz-title");

    // ---- (b) HExA ----
    S.b = el("g", { class: "tz-panel" });
    el("rect", { x: 46, y: 118, width: 650, height: 262, rx: 8, fill: "#fdf2c9", stroke: "#3b3b98", "stroke-dasharray": "6 4", "stroke-width": 1.5 }, S.b);
    el("rect", { x: 38, y: 126, width: 650, height: 262, rx: 8, fill: "#dff0db", stroke: "#3b3b98", "stroke-dasharray": "6 4", "stroke-width": 1.5 }, S.b);
    S.bFront = el("rect", { x: 30, y: 134, width: 650, height: 262, rx: 8, fill: "#dde9f8", stroke: "#3b3b98", "stroke-dasharray": "6 4", "stroke-width": 1.5 }, S.b);
    el("text", { x: 40, y: 112, class: "tz-t13" }, S.b, "K tasks (stacked: Task 1, Task 2, …, Task k)");
    el("text", { x: 672, y: 152, class: "tz-t12", "text-anchor": "end" }, S.b, "Task 1");
    el("text", { x: 170, y: 160, class: "tz-t14", "text-anchor": "middle" }, S.b, "Seed 1");
    el("text", { x: 466, y: 160, class: "tz-t14", "text-anchor": "middle" }, S.b, "Seed X");
    const rowsY = [178, 238, 344];
    // illustrative outcomes: the bank makes later meta-episodes succeed more often
    const outs = [["bad", "bad"], ["bad", "ok"], ["ok", "ok"]];
    S.rows = rowsY.map((y, r) => {
      const s1 = strip(S.b, 40, y, outs[r][0]);
      el("text", { x: 312, y: y + 17, class: "tz-t16", "text-anchor": "middle" }, S.b, "···");
      const s2 = strip(S.b, 336, y, outs[r][1]);
      const d = cell(S.b, 630, y, "distill", "tz-distill");
      arrow(588, y + 12, 626, y + 12);
      return { strips: [s1, s2], distill: d, y };
    });
    el("text", { x: 164, y: 322, class: "tz-t16", "text-anchor": "middle" }, S.b, "⋮");
    el("text", { x: 460, y: 330, class: "tz-t16", "text-anchor": "middle" }, S.b, "⋮");
    arrow(368, 292, 588, 292); label(478, 287, "T turns per inner episode", "tz-t12");
    // axes
    el("line", { x1: 30, y1: 408, x2: 676, y2: 408, class: "tz-arrow", "marker-end": "url(#tz-head)" }, S.b);
    label(353, 426, "X inner episodes per meta-episode (one round, fixed skill context G_n)", "tz-t13");
    el("line", { x1: 16, y1: 140, x2: 16, y2: 392, class: "tz-arrow", "marker-end": "url(#tz-head)" }, S.b);
    el("text", { x: 10, y: 266, class: "tz-t13 tz-red", "text-anchor": "middle", transform: "rotate(-90 10 266)" }, S.b, "R meta-episodes (rounds)");
    S.bTitle = label(353, 452, "(b) HExA: meta-episodes evolve a skill bank", "tz-title");

    // in-panel skill bank, right of the distill column
    S.kb = el("g", { class: "tz-kb" });
    el("rect", { x: 704, y: 176, width: 92, height: 190, rx: 8, fill: "#e4e0f7", stroke: "#3b3b98", "stroke-width": 2 }, S.kb);
    label(750, 196, "Skill Bank", "tz-t13");
    S.kbName = label(750, 214, "K_0", "tz-t14b");
    S.kbBars = [];
    for (let i = 0; i < 6; i++) S.kbBars.push(el("rect", { x: 716, y: 226 + i * 22, width: 68, height: 14, rx: 3, class: "tz-skill" }, S.kb));
    S.rows.forEach((row) => arrow(656, row.y + 12, 702, Math.min(Math.max(row.y + 12, 186), 356)));

    // ---- (c) transfer ----
    S.c = el("g", { class: "tz-panel" });
    el("rect", { x: 826, y: 30, width: 364, height: 400, rx: 8, fill: "none", stroke: "#3b3b98", "stroke-dasharray": "6 4", "stroke-width": 1.5 }, S.c);
    S.cTitle = label(1008, 22, "(c) Skill transfer to unseen harder tasks", "tz-title");
    const tY = [60, 130, 230];
    S.tasks = tY.map((y, i) => {
      el("text", { x: 838, y: y + 15, class: "tz-t13" }, S.c, ["Task 1", "Task 2", "Task k"][i]);
      const st = strip(S.c, 886, y, null, 0.62);
      const b = el("g", { class: "tz-cbank" }, S.c);
      el("rect", { x: 1046, y: y - 8, width: 56, height: 34, rx: 6, fill: "#e4e0f7", stroke: "#3b3b98", "stroke-width": 1.6 }, b);
      el("text", { x: 1074, y: y + 14, class: "tz-t13", "text-anchor": "middle" }, b, ["B₁", "B₂", "Bₖ"][i]);
      arrow(1028, y + 9, 1044, y + 9);
      arrow(1102, y + 9, 1118, 150 + (i - 1) * 10, "tz-arrow-thin");
      return { strip: st, bank: b };
    });
    el("text", { x: 960, y: 192, class: "tz-t16", "text-anchor": "middle" }, S.c, "⋮");
    S.synth = el("g", { class: "tz-synth" }, S.c);
    el("rect", { x: 1120, y: 122, width: 62, height: 60, rx: 6, fill: "#d9d2f5", stroke: "#3b3b98", "stroke-width": 1.8 }, S.synth);
    el("text", { x: 1151, y: 147, class: "tz-t12", "text-anchor": "middle" }, S.synth, "Cross-task");
    el("text", { x: 1151, y: 162, class: "tz-t12", "text-anchor": "middle" }, S.synth, "synthesis");
    arrow(1151, 184, 1151, 300);
    S.bsyn = el("g", { class: "tz-bsyn" }, S.c);
    el("rect", { x: 1108, y: 302, width: 76, height: 46, rx: 6, fill: "#d9d2f5", stroke: "#3b3b98", "stroke-width": 1.8 }, S.bsyn);
    el("text", { x: 1146, y: 322, class: "tz-t12", "text-anchor": "middle" }, S.bsyn, "Synthesised");
    rich(el("text", { x: 1146, y: 339, class: "tz-t13", "text-anchor": "middle" }, S.bsyn), "B_{syn}");
    el("text", { x: 838, y: 342, class: "tz-t13" }, S.c, "Target");
    el("text", { x: 838, y: 357, class: "tz-t13" }, S.c, "task");
    S.target = strip(S.c, 886, 334, null, 0.62);
    arrow(1106, 343, 1030, 343);
    S.cNote = label(1008, 400, "No target trajectories or experimentation needed", "tz-t13");
    // link from (b)'s bank into (c)
    el("polyline", { points: "796,240 812,240 812,69 834,69", fill: "none", class: "tz-arrow tz-arrow-thin", "marker-end": "url(#tz-head)" });

    // ---- meta-RL formulation band ----
    S.f = el("g", { class: "tz-formulas" });
    const fx = [40, 430, 820];
    S.form = [
      ["Inner loop (one episode)", "a_t ~ π_{act}( · | ℓ, s, G_n, h_t )"],
      ["Outer loop (after each meta-episode)", "K_n = π_{ev}( K_{n−1}, T^{(n)} )"],
      ["Transfer (no target trajectories)", "K_{ℓ*} = π^{tr}_{ev}( {K_{ℓi}}, desc(ℓ*) )"],
    ].map((f, i) => {
      const g = el("g", { class: "tz-form" }, S.f);
      el("rect", { x: fx[i], y: 474, width: 360, height: 56, rx: 8 }, g);
      el("text", { x: fx[i] + 14, y: 495, class: "tz-t12 tz-muted" }, g, f[0]);
      rich(el("text", { x: fx[i] + 14, y: 517, class: "tz-t15 tz-mono" }, g), f[1]);
      return g;
    });
    S.status = label(600, 554, "", "tz-status");

    // ---- legend ----
    const lg = el("g", { class: "tz-legend", transform: "translate(70,580)" });
    const items = [["q", "Question"], ["state", "Get state"], ["tool", "Tool obs."], ["sim", "Simulate"], ["other", "Other tools"],
                   ["ok", "Success"], ["bad", "Failure"], ["distill", "Skill distillation"]];
    items.forEach((it, i) => {
      const k = it[0], t = it[1];
      const x = i * 132;
      if (k === "q") { const g = el("g", { transform: `translate(${x},-8) scale(0.7)` }, lg); qbox(g, 0, 0); }
      else { const g = el("g", { transform: `translate(${x},-8) scale(0.7)` }, lg); cell(g, 0, 0, k); }
      el("text", { x: x + 24, y: 5, class: "tz-t12" }, lg, t);
    });
  }

  // ---------- timeline ----------
  const wait = (ms, id) => new Promise((res, rej) => {
    const t = setTimeout(() => (id === runId ? res() : rej("stale")), ms); timers.push(t);
  });
  const on = (e) => e && e.classList.add("on");
  const off = (e) => e && e.classList.remove("on");
  function setForm(i, text) {
    S.form.forEach((f, j) => f.classList.toggle("on", j === i));
    S.status.textContent = text || "";
  }
  function reset() {
    svg.querySelectorAll(".on").forEach((e) => e.classList.remove("on"));
    svg.querySelectorAll(".tz-dim").forEach((e) => e.classList.remove("tz-dim"));
    rich(S.kbName, "K_0");
  }
  async function fill(st, id, ms) {
    for (const c of st.cells) { on(c); await wait(ms, id); }
  }
  async function run() {
    const id = ++runId;
    try {
      while (true) {
        reset();
        // (a) ReAct
        setForm(0, "(a) ReAct: each episode is solved independently, with no learning across episodes");
        on(S.aTitle);
        for (const st of S.aStrips) { await fill(st, id, 110); await wait(250, id); }
        await wait(700, id);
        // (b) HExA meta-episodes
        S.aStrips.forEach((s) => s.g.classList.add("tz-dim"));
        on(S.bTitle);
        on(S.kbBars[0]); on(S.kbBars[1]);   // warm-start bank K0
        for (let r = 0; r < S.rows.length; r++) {
          const row = S.rows[r];
          const name = r === 2 ? "R" : String(r + 1);
          setForm(0, `Meta-episode ${name}: X inner episodes, all conditioned on the same skills retrieved from the current bank`);
          for (const st of row.strips) { on(st.chip); await wait(120, id); }
          for (const st of row.strips) { await fill(st, id, 85); await wait(150, id); }
          setForm(1, `After meta-episode ${name}: the evolver distils its trajectories (and rewards) into the bank`);
          on(row.distill); await wait(500, id);
          on(S.kbBars[Math.min(2 + r * 2, 5)]); on(S.kbBars[Math.min(3 + r * 2, 5)]);
          rich(S.kbName, r === 0 ? "K_1" : r === 1 ? "K_2" : "K_R");
          S.kb.classList.add("on"); await wait(700, id); S.kb.classList.remove("on");
        }
        await wait(500, id);
        // (c) transfer
        setForm(2, "(c) Banks evolved on K source tasks are synthesised for an unseen target task, with no target trajectories");
        on(S.cTitle);
        for (const t of S.tasks) { await fill(t.strip, id, 45); on(t.bank); await wait(200, id); }
        on(S.synth); await wait(700, id);
        on(S.bsyn); await wait(500, id);
        on(S.target.chip); await wait(200, id);
        await fill(S.target, id, 90);
        on(S.cNote);
        await wait(3500, id);
      }
    } catch (e) { /* stale run */ }
  }
  function stop() { runId++; timers.forEach(clearTimeout); timers = []; }
  function showFinal() {           // paused state: everything visible
    svg.querySelectorAll(".tz-cell, .tz-chip, .tz-skill, .tz-cbank, .tz-synth, .tz-bsyn, .tz-title, .tz-distill").forEach(on);
    svg.querySelectorAll(".tz-dim").forEach((e) => e.classList.remove("tz-dim"));
    S.form.forEach((f) => f.classList.add("on"));
    on(S.cNote); rich(S.kbName, "K_R"); S.status.textContent = "";
  }

  // ---------- controls ----------
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  build();
  function setView(animated) {
    host.hidden = !animated; img.hidden = animated;
    btnPlay.hidden = !animated;
    btnView.textContent = animated ? "Show static figure" : "Show animation";
    if (!animated) { stop(); } else if (playing) { run(); } else { stop(); showFinal(); }
  }
  btnPlay.addEventListener("click", () => {
    playing = !playing;
    btnPlay.textContent = playing ? "Pause" : "Play";
    if (playing) run(); else { stop(); showFinal(); }
  });
  btnView.addEventListener("click", () => setView(host.hidden));
  document.getElementById("teaser-controls").hidden = false;
  if (reduce) { playing = false; btnPlay.textContent = "Play"; setView(false); } else { setView(true); }
})();
