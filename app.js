/* ============================================================================
 * Island Simulator — UI / render
 * ==========================================================================*/
(function () {
const { newWorld, step, stage, need, fullName, alive, totalMoney, CFG } = window.Island;

let world = newWorld();
let playing = false;
let timer = null;

const $ = id => document.getElementById(id);
const fmt = n => (Math.round(n * 10) / 10).toLocaleString("es-ES");
const fmt0 = n => Math.round(n).toLocaleString("es-ES");

// --- Controles --------------------------------------------------------------
$("stepBtn").onclick = () => { step(world); render(); };
$("resetBtn").onclick = () => { world = newWorld(); stopPlay(); render(); };
$("playBtn").onclick = () => playing ? stopPlay() : startPlay();

function startPlay() {
  playing = true; $("playBtn").classList.add("active"); $("playBtn").textContent = "⏸ Pausa";
  timer = setInterval(() => {
    step(world); render();
    if (alive(world).length === 0) stopPlay();
  }, 450);
}
function stopPlay() {
  playing = false; $("playBtn").classList.remove("active"); $("playBtn").textContent = "⏩ Auto";
  if (timer) clearInterval(timer);
}

// Sliders de política
function bindSlider(id, key, fmtFn) {
  const el = $(id);
  const upd = () => {
    const v = parseFloat(el.value);
    world.policy[key] = v;
    $(id + "V").textContent = fmtFn(v);
  };
  el.oninput = upd; upd();
}
bindSlider("pension", "pension", v => fmt(v));
bindSlider("ubi", "ubi", v => fmt(v));
bindSlider("builders", "buildersPct", v => Math.round(v * 100) + "%");

// Tabs
document.querySelectorAll(".tab-btn").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".view").forEach(x => x.classList.remove("show"));
    b.classList.add("active");
    $("view-" + b.dataset.view).classList.add("show");
    render();
  };
});

// --- Render principal -------------------------------------------------------
function render() {
  const w = world;
  const living = alive(w);
  $("dayNum").textContent = w.day;
  $("season").textContent = w.drought > 0 ? "🌵 Sequía" :
    (w.abundance > 1.1 ? "🐟 Abundancia" : (w.abundance < 0.8 ? "🌧️ Escasez" : "⛅ Normal"));

  // Stats
  $("pop").textContent = living.length;
  $("stock").textContent = fmt0(w.fishStock);
  const children = living.filter(p => stage(p) === "child").length;
  const adults = living.filter(p => stage(p) === "adult").length;
  const olds = living.filter(p => stage(p) === "old").length;
  $("ages").textContent = `${children} / ${adults} / ${olds}`;
  const freeH = w.houses.filter(h => h.ownerId === null).length;
  $("houses").textContent = `${w.houses.length} (${freeH})`;

  $("priceFish").textContent = fmt(w.priceFish);
  $("priceHouse").textContent = fmt0(w.priceHouse);
  $("money").textContent = fmt0(totalMoney(w));
  $("printed").textContent = fmt0(w.moneyPrinted);

  // Inflación pill
  const infl = w.prevPriceFish > 0 ? ((w.priceFish - w.prevPriceFish) / w.prevPriceFish) * 100 : 0;
  const pill = $("fishInfl");
  pill.textContent = (infl >= 0 ? "+" : "") + infl.toFixed(1) + "%";
  pill.className = "pill " + (infl > 0.5 ? "up" : (infl < -0.5 ? "down" : "flat"));

  // Log
  $("log").innerHTML = w.log.map(l => `<div>${l}</div>`).join("");

  drawIsland();
  drawCharts();
  if ($("view-tree").classList.contains("show")) drawTree();
  if ($("view-people").classList.contains("show")) drawPeople();
}

// --- Isla (SVG) -------------------------------------------------------------
function drawIsland() {
  const w = world;
  const svg = $("island");
  const W = 800, H = 420;
  const living = alive(w);

  let s = "";
  // mar
  s += `<rect width="${W}" height="${H}" fill="url(#sea)"/>`;
  // isla (elipse de arena con hierba encima)
  s += `<ellipse cx="400" cy="300" rx="330" ry="150" fill="#e8d6a3"/>`;
  s += `<ellipse cx="400" cy="285" rx="300" ry="125" fill="#7bc86c"/>`;
  s += `<ellipse cx="400" cy="275" rx="250" ry="95" fill="#8fd47e"/>`;
  // palmeras decorativas
  for (const [px,py] of [[120,250],[690,260],[400,190]]) {
    s += `<rect x="${px-3}" y="${py}" width="6" height="34" fill="#8a5a2b"/>`;
    s += `<circle cx="${px}" cy="${py}" r="16" fill="#3f9d4a"/>`;
  }
  // casas
  w.houses.forEach(h => {
    const x = 120 + h.x * 560, y = 190 + h.y * 150;
    const occupied = h.ownerId !== null;
    s += houseSVG(x, y, occupied);
  });
  // habitantes
  living.forEach(p => {
    const x = 120 + p.x * 560, y = 210 + p.y * 160;
    s += personSVG(x, y, p);
  });

  const defs = `<defs>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4aa3d4"/><stop offset="1" stop-color="#2a7bb8"/>
    </linearGradient></defs>`;
  svg.innerHTML = defs + s;
}

function houseSVG(x, y, occupied) {
  const c = occupied ? "#c86b4a" : "#c9c0a8";
  return `<g>
    <rect x="${x-11}" y="${y}" width="22" height="16" fill="${c}" rx="2"/>
    <polygon points="${x-14},${y} ${x+14},${y} ${x},${y-11}" fill="#7a4327"/>
    <rect x="${x-3}" y="${y+6}" width="6" height="10" fill="#5a3a1f"/>
  </g>`;
}

function personSVG(x, y, p) {
  const st = stage(p);
  const color = st === "child" ? "#7cc4e8" : (st === "adult" ? "#2e8b57" : "#9b7fb3");
  const r = st === "child" ? 4 : 5.5;
  const building = p.building > 0;
  const hungry = p.daysHungry > 0;
  let g = `<g>`;
  g += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="#20323f" stroke-width="1"/>`;
  g += `<circle cx="${x}" cy="${y-r-3}" r="${r-1.5}" fill="${color}" stroke="#20323f" stroke-width="1"/>`;
  if (p.sex === "F") g += `<circle cx="${x}" cy="${y-r-3}" r="1.3" fill="#e6a817"/>`;
  if (building) g += `<text x="${x+6}" y="${y-6}" font-size="11">🔨</text>`;
  if (hungry) g += `<text x="${x+5}" y="${y+2}" font-size="10">🍽️</text>`;
  g += `<text x="${x}" y="${y+14}" font-size="8" text-anchor="middle" fill="#20323f">${p.firstName}</text>`;
  g += `</g>`;
  return g;
}

// --- Gráficas (canvas) ------------------------------------------------------
function lineChart(canvas, series, colors, fill) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr; ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const pad = 4;
  series.forEach((data, si) => {
    if (data.length < 2) return;
    const max = Math.max(...data, 0.0001), min = Math.min(...data, 0);
    const rng = (max - min) || 1;
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad + (i / (data.length - 1)) * (W - 2 * pad);
      const y = H - pad - ((v - min) / rng) * (H - 2 * pad);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = colors[si]; ctx.lineWidth = 2; ctx.stroke();
  });
}

function drawCharts() {
  const h = world.history;
  if (!h.length) return;
  lineChart($("chartPrice"),
    [h.map(d => d.priceFish), h.map(d => d.money)],
    ["#d8544f", "#e6a817"]);
  lineChart($("chartPop"),
    [h.map(d => d.pop), h.map(d => d.fishStock)],
    ["#1f7a8c", "#3fa34d"]);
}

// --- Tabla de habitantes ----------------------------------------------------
function drawPeople() {
  const living = alive(world).sort((a, b) => a.id - b.id);
  const stName = { child: "Niño", adult: "Adulto", old: "Viejo" };
  $("peopleBody").innerHTML = living.map(p => {
    const st = stage(p);
    const state = p.daysHungry > 0 ? `🍽️ Hambre (${p.daysHungry})` :
      (p.building > 0 ? `🔨 Construye` : (p.partnerId ? "👨‍👩‍👧 Familia" : "Soltero"));
    return `<tr>
      <td>${fullName(p)} ${p.sex === "F" ? "♀" : "♂"}</td>
      <td>${Math.floor(p.age)}</td>
      <td>${stName[st]}</td>
      <td>${fmt0(p.caracolas)}</td>
      <td>${state}</td></tr>`;
  }).join("");
}

// --- Árbol genealógico ------------------------------------------------------
function drawTree() {
  const w = world;
  // generación de cada persona (fundadores = 0)
  const byId = new Map(w.people.map(p => [p.id, p]));
  const gen = new Map();
  function genOf(p) {
    if (gen.has(p.id)) return gen.get(p.id);
    if (!p.parents) { gen.set(p.id, 0); return 0; }
    const g = 1 + Math.max(...p.parents.map(pid => {
      const par = byId.get(pid); return par ? genOf(par) : 0;
    }));
    gen.set(p.id, g); return g;
  }
  w.people.forEach(genOf);

  // agrupar por generación
  const maxGen = Math.max(0, ...[...gen.values()]);
  const rows = Array.from({ length: maxGen + 1 }, () => []);
  w.people.forEach(p => rows[gen.get(p.id)].push(p));

  const NW = 96, NH = 34, GAPX = 16, GAPY = 70;
  // asignar posiciones
  const pos = new Map();
  let maxCols = 0;
  rows.forEach((row, g) => {
    row.sort((a, b) => a.id - b.id);
    maxCols = Math.max(maxCols, row.length);
    row.forEach((p, i) => {
      pos.set(p.id, { x: i * (NW + GAPX) + 20, y: g * GAPY + 20, g });
    });
  });

  const W = Math.max(maxCols * (NW + GAPX) + 40, 400);
  const H = (maxGen + 1) * GAPY + 40;

  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="tree-svg" style="min-width:100%">`;
  // líneas padre->hijo
  w.people.forEach(p => {
    if (!p.parents) return;
    const cp = pos.get(p.id); if (!cp) return;
    p.parents.forEach(pid => {
      const pp = pos.get(pid); if (!pp) return;
      svg += `<line x1="${pp.x + NW / 2}" y1="${pp.y + NH}" x2="${cp.x + NW / 2}" y2="${cp.y}"
        stroke="#b9c7d0" stroke-width="1.5"/>`;
    });
  });
  // líneas de pareja (misma generación)
  const drawn = new Set();
  w.people.forEach(p => {
    if (!p.partnerId || drawn.has(p.id)) return;
    const a = pos.get(p.id), b = pos.get(p.partnerId);
    if (!a || !b) return;
    drawn.add(p.id); drawn.add(p.partnerId);
    svg += `<line x1="${a.x + NW / 2}" y1="${a.y + NH / 2}" x2="${b.x + NW / 2}" y2="${b.y + NH / 2}"
      stroke="#e6a817" stroke-width="2" stroke-dasharray="3,2"/>`;
  });
  // nodos
  w.people.forEach(p => {
    const pp = pos.get(p.id); if (!pp) return;
    const st = stage(p);
    const base = !p.alive ? "#d6dbe0" :
      (st === "child" ? "#d4ecfa" : (st === "adult" ? "#d7f0e0" : "#ece4f3"));
    const stroke = !p.alive ? "#aab4bc" : "#8aa0ae";
    svg += `<g class="tree-node">
      <rect x="${pp.x}" y="${pp.y}" width="${NW}" height="${NH}" fill="${base}"
        stroke="${stroke}" stroke-width="1"/>
      <text x="${pp.x + NW / 2}" y="${pp.y + 13}" font-size="9" text-anchor="middle" font-weight="700" fill="#20323f">
        ${esc(p.firstName)} ${p.sex === "F" ? "♀" : "♂"}${p.alive ? "" : " †"}</text>
      <text x="${pp.x + NW / 2}" y="${pp.y + 25}" font-size="8" text-anchor="middle" fill="#6b7c89">
        ${esc(p.surname)}</text>
    </g>`;
  });
  svg += `</svg>`;
  $("tree").innerHTML = svg;
}

function esc(s) { return String(s).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])); }

// Primer render
render();
})();
