"use strict";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  return res.json();
}
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ------------------------------------------------------------ graph */
const REST = { REJECTED: 70, SUPPORTED_BY: 62, DEPENDS_ON: 62, IMPLEMENTED_IN: 92, CONSTRAINED_BY: 104, SUPERSEDES: 120, INVALIDATED_IF: 110 };
const EDGE_COLOR = { SUPERSEDES: "#7a8794", INVALIDATED_IF: "#b3261e", CONSTRAINED_BY: "#b3261e" };
const G = {
  nodes: [], edges: [], byId: {}, tx: 0, ty: 0, k: 1, w: 0, h: 0, dpr: 1,
  autoFit: true, hl: null, selected: null, hover: null, drag: null, alpha: 0, showOld: true, colors: {},

  init() {
    this.cv = $("#cv"); this.ctx = this.cv.getContext("2d");
    this.colors = { decision: css("--decision"), constraint: css("--constraint"), alternative: css("--alternative"),
      evidence: css("--evidence"), assumption: css("--assumption"), code: css("--code"), ink: css("--ink"), muted: css("--muted") };
    new ResizeObserver(() => this.resize()).observe($("#canvasPanel"));
    this.cv.addEventListener("mousedown", (e) => this.down(e));
    window.addEventListener("mousemove", (e) => this.move(e));
    window.addEventListener("mouseup", () => this.up());
    this.cv.addEventListener("wheel", (e) => this.wheel(e), { passive: false });
    $("#showOld").addEventListener("change", (e) => { this.showOld = e.target.checked; });
    $("#clearHl").addEventListener("click", () => this.highlight(null));
    requestAnimationFrame(() => this.frame());
  },

  resize() {
    const p = $("#canvasPanel");
    this.w = p.clientWidth; this.h = p.clientHeight; this.dpr = window.devicePixelRatio || 1;
    this.cv.width = this.w * this.dpr; this.cv.height = this.h * this.dpr;
    if (!this.fitted && this.nodes.length && this.w > 0) { this.fit(); this.fitted = true; }
  },

  load(data, animate) {
    const old = this.byId;
    const fresh = [];
    this.nodes = data.nodes.map((n, i) => {
      const prev = old[n.id];
      if (prev) { Object.assign(prev, n); return prev; }
      const a = i * 2.399963, r = 40 + 14 * Math.sqrt(i);
      const node = Object.assign({}, n, { x: Math.cos(a) * r * 3, y: Math.sin(a) * r * 2, vx: 0, vy: 0, born: 0 });
      if (Object.keys(old).length) { node.born = performance.now(); fresh.push(node); }
      return node;
    });
    this.byId = {}; this.nodes.forEach((n) => { this.byId[n.id] = n; });
    this.edges = data.edges.map((e) => ({ a: this.byId[e.source], b: this.byId[e.target], type: e.type })).filter((e) => e.a && e.b);
    fresh.forEach((n) => { // start new nodes next to a neighbour
      const edge = this.edges.find((e) => e.a === n || e.b === n);
      if (edge) { const o = edge.a === n ? edge.b : edge.a; n.x = o.x + 30; n.y = o.y + 30; }
    });
    if (!Object.keys(old).length) {
      for (let i = 0; i < 420; i++) this.step(1);
      this.alpha = 0; this.fitted = false; this.resize();
      if (animate) { const t = performance.now(); this.nodes.forEach((n, i) => { n.born = t + i * 90; }); }
    } else this.alpha = 1;
    $("#emptyHint").hidden = this.nodes.length > 0;
  },

  fitTarget() {
    if (!this.nodes.length) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    this.nodes.forEach((n) => { if (!this.visible(n)) return; x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); });
    const pad = 70;
    const k = Math.min(1.4, (this.w - pad * 2) / Math.max(1, x1 - x0), (this.h - pad * 2 - 40) / Math.max(1, y1 - y0));
    return { k, tx: this.w / 2 - ((x0 + x1) / 2) * k, ty: this.h / 2 - ((y0 + y1) / 2) * k - 14 };
  },

  fit() {
    if (!this.nodes.length) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    this.nodes.forEach((n) => { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); });
    const pad = 70;
    this.k = Math.min(1.4, (this.w - pad * 2) / Math.max(1, x1 - x0), (this.h - pad * 2 - 40) / Math.max(1, y1 - y0));
    this.tx = this.w / 2 - ((x0 + x1) / 2) * this.k;
    this.ty = this.h / 2 - ((y0 + y1) / 2) * this.k - 14;
  },

  visible(n) { return this.showOld || n.status !== "superseded"; },

  step(alpha) {
    const ns = this.nodes.filter((n) => this.visible(n));
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i], b = ns[j];
        let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        if (d2 > 160000) continue;
        const f = (3400 / d2) * alpha, d = Math.sqrt(d2);
        dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      }
    }
    this.edges.forEach((e) => {
      if (!this.visible(e.a) || !this.visible(e.b)) return;
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - (REST[e.type] || 80)) * 0.035 * alpha, fx = (dx / d) * f, fy = (dy / d) * f;
      e.a.vx += fx; e.a.vy += fy; e.b.vx -= fx; e.b.vy -= fy;
    });
    ns.forEach((n) => {
      n.vx -= n.x * 0.004 * alpha; n.vy -= n.y * 0.006 * alpha;
      if (this.drag && this.drag.node === n) { n.vx = n.vy = 0; return; }
      n.vx *= 0.82; n.vy *= 0.82; n.x += n.vx; n.y += n.vy;
    });
  },

  radius(n) { return { decision: 16, constraint: 14, alternative: 9, evidence: 7, assumption: 8, code: 9 }[n.type] || 8; },
  dim(n) { return this.hl && !this.hl.has(n.id); },

  frame() {
    if (!$("#tab-graph").hidden) {
      if (this.alpha > 0.02) { this.step(this.alpha); this.alpha *= 0.985; }
      if (this.autoFit && !this.drag) {
        const t = this.fitTarget();
        if (t) { this.k += (t.k - this.k) * 0.08; this.tx += (t.tx - this.tx) * 0.08; this.ty += (t.ty - this.ty) * 0.08; }
      }
      this.draw();
    }
    requestAnimationFrame(() => this.frame());
  },

  draw() {
    const c = this.ctx, now = performance.now();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    c.translate(this.tx, this.ty); c.scale(this.k, this.k);

    this.edges.forEach((e) => {
      if (!this.visible(e.a) || !this.visible(e.b)) return;
      if ((e.a.born && now < e.a.born) || (e.b.born && now < e.b.born)) return;
      const faded = this.hl && !(this.hl.has(e.a.id) && this.hl.has(e.b.id));
      c.globalAlpha = faded ? 0.08 : 0.75;
      c.strokeStyle = EDGE_COLOR[e.type] || "#8a97a3";
      c.lineWidth = 1.4;
      c.setLineDash(e.type === "SUPERSEDES" || e.type === "INVALIDATED_IF" ? [6, 4] : []);
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / d, uy = dy / d, rb = this.radius(e.b) + 3;
      const ex = e.b.x - ux * rb, ey = e.b.y - uy * rb;
      c.beginPath(); c.moveTo(e.a.x + ux * this.radius(e.a), e.a.y + uy * this.radius(e.a)); c.lineTo(ex, ey); c.stroke();
      c.setLineDash([]); c.fillStyle = c.strokeStyle;
      c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - ux * 7 - uy * 3.5, ey - uy * 7 + ux * 3.5); c.lineTo(ex - ux * 7 + uy * 3.5, ey - uy * 7 - ux * 3.5); c.closePath(); c.fill();
    });

    for (const n of this.nodes) {
      if (!this.visible(n)) continue;
      const r = this.radius(n), col = this.colors[n.type] || "#667483";
      const old = n.status === "superseded";
      if (n.born && now < n.born) continue;
      c.globalAlpha = this.dim(n) ? 0.12 : old ? 0.45 : 1;
      c.lineWidth = 2; c.fillStyle = col; c.strokeStyle = col;
      c.beginPath();
      if (n.type === "constraint") { c.moveTo(n.x, n.y - r - 3); c.lineTo(n.x + r + 3, n.y); c.lineTo(n.x, n.y + r + 3); c.lineTo(n.x - r - 3, n.y); c.closePath(); c.fill(); }
      else if (n.type === "alternative") { c.fillStyle = "#f7f9fa"; c.setLineDash([3, 3]); c.rect(n.x - r, n.y - r, r * 2, r * 2); c.fill(); c.stroke(); c.setLineDash([]); }
      else if (n.type === "assumption") { c.fillStyle = "#f7f9fa"; c.arc(n.x, n.y, r, 0, 7); c.fill(); c.stroke(); }
      else if (n.type === "code") { const q = r; c.roundRect ? c.roundRect(n.x - q, n.y - q * 0.7, q * 2, q * 1.4, 3) : c.rect(n.x - q, n.y - q * 0.7, q * 2, q * 1.4); c.fill(); }
      else { c.arc(n.x, n.y, r, 0, 7); c.fill(); }
      if (old) { c.setLineDash([4, 3]); c.strokeStyle = this.colors.muted; c.beginPath(); c.arc(n.x, n.y, r + 5, 0, 7); c.stroke(); c.setLineDash([]); }
      if (n.status === "under_review") {
        const pulse = (Math.sin(now / 280) + 1) / 2;
        c.strokeStyle = "#e0a100"; c.lineWidth = 3; c.globalAlpha = 0.45 + 0.55 * pulse;
        c.beginPath(); c.arc(n.x, n.y, r + 6 + pulse * 3, 0, 7); c.stroke();
      }
      if (n.born && now - n.born < 2600) {
        const t = (now - n.born) / 2600; c.globalAlpha = 1 - t; c.strokeStyle = "#2e7d4f"; c.lineWidth = 3;
        c.beginPath(); c.arc(n.x, n.y, r + 4 + t * 26, 0, 7); c.stroke();
      }
      if (this.selected === n.id || (this.hl && this.hl.has(n.id) && (n.type === "constraint" || n.type === "decision"))) {
        c.globalAlpha = 1; c.strokeStyle = this.colors.ink; c.lineWidth = 2.5;
        c.beginPath(); c.arc(n.x, n.y, r + 7, 0, 7); c.stroke();
      }
    }

    const now2 = now; c.globalAlpha = 1; c.textAlign = "center"; c.font = "600 12px " + css("--sans");
    this.nodes.forEach((n) => {
      if (!this.visible(n) || this.dim(n) || (n.born && now < n.born)) return;
      const major = n.type === "decision" || n.type === "constraint";
      if (!major && this.hover !== n.id && this.selected !== n.id) return;
      const text = major ? n.id : n.label, y = n.y + this.radius(n) + 16;
      c.fillStyle = "rgba(247,249,250,0.85)";
      const w = c.measureText(text).width + 8; c.fillRect(n.x - w / 2, y - 12, w, 16);
      c.fillStyle = this.colors.ink; c.fillText(text, n.x, y);
    });
    c.globalAlpha = 1;
  },

  pick(e) {
    const r = this.cv.getBoundingClientRect();
    const x = (e.clientX - r.left - this.tx) / this.k, y = (e.clientY - r.top - this.ty) / this.k;
    let best = null, bd = 1e9;
    this.nodes.forEach((n) => {
      if (!this.visible(n)) return;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < this.radius(n) + 8 && d < bd) { best = n; bd = d; }
    });
    return best;
  },

  down(e) {
    const n = this.pick(e);
    if (!n) this.autoFit = false;
    this.drag = n ? { node: n, moved: false } : { pan: true, x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty, moved: false };
    this.cv.classList.add("drag");
  },
  move(e) {
    const tip = $("#tip");
    if (this.drag) {
      this.drag.moved = true;
      if (this.drag.node) {
        const r = this.cv.getBoundingClientRect();
        this.drag.node.x = (e.clientX - r.left - this.tx) / this.k; this.drag.node.y = (e.clientY - r.top - this.ty) / this.k;
        this.alpha = Math.max(this.alpha, 0.3);
      } else { this.tx = this.drag.tx + e.clientX - this.drag.x; this.ty = this.drag.ty + e.clientY - this.drag.y; }
      tip.style.display = "none"; return;
    }
    if (e.target !== this.cv) { tip.style.display = "none"; return; }
    const n = this.pick(e); this.hover = n ? n.id : null;
    if (n) {
      const r = $("#canvasPanel").getBoundingClientRect();
      tip.textContent = n.text; tip.style.display = "block";
      tip.style.left = Math.min(e.clientX - r.left + 14, r.width - 290) + "px"; tip.style.top = e.clientY - r.top + 14 + "px";
    } else tip.style.display = "none";
  },
  up() {
    if (this.drag && !this.drag.moved) { const n = this.drag.node; if (n) select(n.id); else { this.selected = null; renderEmpty(); } }
    this.drag = null; this.cv.classList.remove("drag");
  },
  wheel(e) {
    e.preventDefault(); this.autoFit = false;
    const r = this.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const k2 = Math.max(0.3, Math.min(3, this.k * (e.deltaY < 0 ? 1.12 : 0.89)));
    this.tx = mx - ((mx - this.tx) / this.k) * k2; this.ty = my - ((my - this.ty) / this.k) * k2; this.k = k2;
  },
  highlight(ids) {
    this.hl = ids && ids.length ? new Set(ids) : null;
    $("#clearHl").hidden = !this.hl;
  },
};

/* ------------------------------------------------------------ side panel */
function setPane(which) {
  const cap = which === "capture";
  $("#paneCapture").hidden = !cap; $("#paneInspect").hidden = cap;
  $("#segCapture").setAttribute("aria-selected", String(cap)); $("#segInspect").setAttribute("aria-selected", String(!cap));
}
$("#segCapture").addEventListener("click", () => setPane("capture"));
$("#segInspect").addEventListener("click", () => setPane("inspect"));

const GROUPS = {
  "out:SUPPORTED_BY": "Evidence", "out:REJECTED": "Options that were rejected", "out:CONSTRAINED_BY": "Rules it must respect",
  "out:DEPENDS_ON": "Assumptions it relies on", "out:SUPERSEDES": "Replaced this earlier decision", "in:SUPERSEDES": "Replaced by",
  "out:IMPLEMENTED_IN": "Code it lives in", "in:CONSTRAINED_BY": "Applies to", "in:REJECTED": "Rejected by", "in:SUPPORTED_BY": "Supports",
  "in:DEPENDS_ON": "Assumed by", "in:IMPLEMENTED_IN": "Decisions implemented here", "out:INVALIDATED_IF": "New evidence that challenges it",
  "in:INVALIDATED_IF": "Challenges",
};
const TYPE_NAME = { decision: "Decision", constraint: "Rule", alternative: "Rejected option", evidence: "Evidence", assumption: "Assumption", code: "Code file" };

function renderEmpty() {
  $("#inspector").innerHTML = '<p class="empty">Click any node in the graph to see why it exists, what supports it and what it limits.</p>';
}
function srcLine(s) {
  if (!s || !s.title) return "";
  return esc(s.title) + (s.date ? " · " + esc(s.date) : "") + (s.line ? " · line " + s.line : "");
}
async function select(id) {
  G.selected = id;
  const res = await api("/api/explain?id=" + encodeURIComponent(id));
  if (!res.node) return;
  setPane("inspect");
  const n = res.node, groups = {};
  res.relations.forEach((r) => { (groups[r.direction + ":" + r.type] = groups[r.direction + ":" + r.type] || []).push(r.node); });
  let html = '<span class="kind ' + n.type + '">' + TYPE_NAME[n.type] + "</span>";
  if (n.status === "superseded") html += '<span class="status superseded">replaced</span>';
  if (n.status === "under_review") html += '<span class="status under_review">under review</span>';
  html += "<h3>" + esc(n.text) + "</h3>";
  html += '<p class="meta">' + (n.type === "decision" || n.type === "constraint" ? esc(n.id) + " · " : "") + srcLine(n.source) + "</p>";
  if (n.extra && n.extra.reason) html += '<div class="note-box"><b>Why rejected:</b> ' + esc(n.extra.reason) + "</div>";
  if (n.extra && n.extra.review_reason) html += '<div class="note-box"><b>Under review.</b> New evidence: ' + esc(n.extra.review_reason) + "</div>";
  if (n.extra && n.extra.invalid_if) html += '<div class="note-box"><b>Would be reconsidered if:</b><br>' + n.extra.invalid_if.map(esc).join("<br>") + "</div>";
  html += '<div class="rel">';
  Object.keys(GROUPS).forEach((key) => {
    if (!groups[key]) return;
    html += "<h4>" + GROUPS[key] + "</h4>";
    groups[key].forEach((m) => { html += '<button class="' + m.type + '" data-id="' + esc(m.id) + '">' + esc(m.type === "code" ? m.text : m.label || m.text) + "</button>"; });
  });
  html += "</div>";
  $("#inspector").innerHTML = html;
  $("#inspector").querySelectorAll(".rel button").forEach((b) => b.addEventListener("click", () => select(b.dataset.id)));
}

async function refreshGraph(animate) {
  const [data, status] = await Promise.all([api("/api/graph"), api("/api/status")]);
  G.load(data, animate);
  G.autoFit = true;
  $("#about").textContent = status.about;
  return status;
}

function showReport(r) {
  let html = "";
  if (r.under_review && r.under_review.length) {
    r.under_review.forEach((u) => {
      html += '<div class="review"><b>Decision ' + esc(u.decision) + " is now under review.</b><br>New evidence: " + esc(u.evidence) +
        "<br><span class='small'>It matches the condition: " + esc(u.condition) + "</span></div>";
    });
  }
  if (r.note) html += "<p class='small'>" + esc(r.note) + "</p>";
  $("#report").innerHTML = html;
}

/* ------------------------------------------------------------ story player */
const story = { steps: [], idx: 0, playing: false, busy: false };
const WHO = ["#1f3b5c", "#2e7d6b", "#7c6ba0", "#b7791f"];

function updateStoryUI() {
  const n = story.steps.length;
  $("#storyCount").textContent = n ? "Meeting " + Math.min(story.idx, n) + " of " + n : "No story for this project";
  const done = story.idx >= n && n > 0;
  $("#playBtn").textContent = story.playing ? "⏸ Pause" : done ? "↻ Replay story" : story.idx > 0 ? "▶ Continue" : "▶ Play all";
  $("#playBtn").disabled = !n || (story.busy && !story.playing);
  $("#nextBtn").disabled = !n || done || story.busy || story.playing;
}

async function playStep() {
  const step = story.steps[story.idx];
  story.busy = true; updateStoryUI();
  const box = $("#meeting");
  box.innerHTML = '<div class="m-title">' + esc(step.title) + '</div><div class="m-date">' + esc(step.date) + '</div><div id="chat"></div><div id="found"></div>';
  const people = {};
  for (const [who, text] of step.chat) {
    if (!story.busy) break;
    if (!(who in people)) people[who] = Object.keys(people).length;
    const b = document.createElement("div");
    b.className = "bubble"; b.innerHTML = '<b style="color:' + WHO[people[who] % WHO.length] + '">' + esc(who) + "</b> " + esc(text);
    $("#chat").appendChild(b); await sleep(30); b.classList.add("show");
    $("#chat").scrollTop = $("#chat").scrollHeight;
    await sleep(Math.min(1500, 450 + text.length * 14));
  }
  $("#found").innerHTML = '<div class="reading">Memento is reading the notes…</div>';
  await sleep(700);
  const r = await api("/api/ingest", { name: step.file, text: step.note });
  const hadNodes = G.nodes.length > 0;
  await refreshGraph(!hadNodes);
  showReport(r);
  $("#found").innerHTML = '<div class="captured"><b>Memento captured ' + r.items.length + ' item' + (r.items.length === 1 ? "" : "s") + ":</b><div class='found-chips' id='fc'></div></div>";
  for (const it of r.items) {
    const c = document.createElement("span");
    c.className = "fchip " + it.type; c.textContent = TYPE_NAME[it.type] + ": " + it.label;
    $("#fc").appendChild(c); await sleep(260);
  }
  story.idx++; story.busy = false; updateStoryUI();
}

async function play() {
  if (story.busy && !story.playing) return;
  if (story.playing) { story.playing = false; updateStoryUI(); return; }
  if (story.idx >= story.steps.length) { await resetProject(true); }
  story.playing = true; updateStoryUI();
  while (story.playing && story.idx < story.steps.length) {
    await playStep();
    if (story.playing && story.idx < story.steps.length) await sleep(1100);
  }
  story.playing = false; updateStoryUI();
  if (story.idx >= story.steps.length) { setPane("capture"); }
}

async function resetProject(empty, project) {
  story.playing = false; story.busy = false;
  await api("/api/reset", { empty: !!empty, project: project || undefined });
  G.nodes = []; G.byId = {}; G.fitted = false; G.highlight(null); renderEmpty(); setPane("capture");
  const status = await refreshGraph(false);
  story.steps = await api("/api/story");
  story.idx = empty ? 0 : story.steps.length;
  $("#meeting").innerHTML = empty && story.steps.length ? '<p class="small">Press <b>Play all</b> to watch the team\'s five meetings being captured, one by one.</p>' :
    story.steps.length ? '<p class="small">The finished project is loaded. Press <b>Replay story</b> to watch it being built from nothing.</p>' :
    '<p class="small">This project has no recorded story. Capture your own notes below.</p>';
  $("#report").innerHTML = "";
  updateStoryUI();
  return status;
}

/* ------------------------------------------------------------ manual capture */
const KINDS = [
  { id: "decision", tag: "Decision", label: "Decision", hint: "e.g. Use a QR code so students collect meals quickly" },
  { id: "alternative", tag: "Rejected", label: "Rejected option", hint: "e.g. Paper tokens - students keep losing them" },
  { id: "evidence", tag: "Evidence", label: "Evidence", hint: "e.g. We tried it with 10 students and it worked" },
  { id: "constraint", tag: "Constraint", label: "Rule", hint: "e.g. Never show a student's roll number publicly" },
  { id: "assumption", tag: "Assumption", label: "Assumption", hint: "e.g. At most 300 orders a day" },
  { id: "changeif", tag: "Invalidated if", label: "Change if", hint: "e.g. Orders go above 1,000 a day" },
];
const cap = { kind: "decision", staged: [] };
function renderKinds() {
  $("#kinds").innerHTML = KINDS.map((k) => '<button class="kbtn ' + k.id + '" data-k="' + k.id + '" aria-pressed="' + (cap.kind === k.id) + '">' + k.label + "</button>").join("");
  $("#kinds").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { cap.kind = b.dataset.k; renderKinds(); }));
  $("#itemText").placeholder = KINDS.find((k) => k.id === cap.kind).hint;
}
function renderStaged() {
  $("#staged").innerHTML = cap.staged.map((s, i) => '<div class="fchip ' + s.kind + '">' + esc(KINDS.find((k) => k.id === s.kind).label) + ": " + esc(s.text) + ' <button aria-label="remove" data-i="' + i + '">×</button></div>').join("");
  $("#staged").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { cap.staged.splice(+b.dataset.i, 1); renderStaged(); }));
  $("#saveNote").disabled = cap.staged.length === 0;
}
function addItem() {
  const text = $("#itemText").value.trim();
  if (!text) return;
  cap.staged.push({ kind: cap.kind, text }); $("#itemText").value = ""; renderStaged();
}
async function saveNote() {
  const today = new Date().toISOString().slice(0, 10);
  const lines = cap.staged.map((s) => KINDS.find((k) => k.id === s.kind).tag + ": " + s.text);
  const files = $("#itemFiles").value.trim();
  if (files) lines.push("Touches: " + files);
  const text = "# Live note\nType: meeting\nDate: " + today + "\n\n" + lines.join("\n") + "\n";
  $("#saveNote").disabled = true;
  const r = await api("/api/ingest", { text });
  const had = G.nodes.length > 0;
  await refreshGraph(!had);
  showReport(r);
  if (!r.under_review.length) {
    $("#report").innerHTML += '<div class="captured"><b>Added ' + r.items.length + " item" + (r.items.length === 1 ? "" : "s") + " to the graph.</b></div>";
  }
  cap.staged = []; $("#itemFiles").value = ""; renderStaged();
}
async function ingestPasted() {
  const text = $("#noteText").value;
  if (!text.trim()) return;
  $("#ingestBtn").disabled = true;
  const r = await api("/api/ingest", { text });
  $("#ingestBtn").disabled = false;
  const had = G.nodes.length > 0;
  await refreshGraph(!had);
  showReport(r);
  if (!r.under_review.length) {
    $("#report").innerHTML += "<div class='captured'><b>Added " + r.items.length + " item" + (r.items.length === 1 ? "" : "s") + ".</b>" + (r.items.length ? "" : " Nothing tagged was found. Use lines such as <code>Decision: ...</code> or <code>Evidence: ...</code>.") + "</div>";
  }
  const ids = r.under_review.map((u) => u.decision);
  if (ids.length) { G.highlight(ids); select(ids[0]); }
}

/* ------------------------------------------------------------ start */
async function loadExampleNote() {
  const p = await api("/api/presets");
  $("#noteText").value = p.example_note;
}

(async function start() {
  G.init();
  renderKinds(); renderStaged();
  const status = await refreshGraph(false);
  $("#project").innerHTML = Object.entries(status.projects).map(([k, v]) => '<option value="' + k + '"' + (k === status.project ? " selected" : "") + ">" + esc(v) + "</option>").join("");
  story.steps = await api("/api/story");
  story.idx = status.nodes > 0 ? story.steps.length : 0;
  if (story.steps.length) $("#meeting").innerHTML = '<p class="small">The finished project is loaded. For the live demo press <b>Start with an empty project</b>, then <b>Play all</b>.</p>';
  else $("#meeting").innerHTML = '<p class="small">This project has no recorded story. Capture your own notes below.</p>';
  updateStoryUI();
  await loadExampleNote();
  $("#playBtn").addEventListener("click", play);
  $("#nextBtn").addEventListener("click", async () => { if (!story.busy) await playStep(); });
  $("#emptyBtn").addEventListener("click", () => resetProject(true));
  $("#fullBtn").addEventListener("click", () => resetProject(false));
  $("#project").addEventListener("change", async (e) => { await resetProject(false, e.target.value); await loadExampleNote(); });
  $("#addItem").addEventListener("click", addItem);
  $("#itemText").addEventListener("keydown", (e) => { if (e.key === "Enter") addItem(); });
  $("#saveNote").addEventListener("click", saveNote);
  $("#ingestBtn").addEventListener("click", ingestPasted);
})();
