/* ============================================================================
 * Island Simulator — UI / render
 * ==========================================================================*/
(function () {
const { newWorld, step, stage, need, fullName, alive, totalMoney, walletOf, hhOf, setRetireAge, CFG } = window.Island;
const SC = window.Scenarios;

const $ = id => document.getElementById(id);
const fmt = n => (Math.round(n * 10) / 10).toLocaleString("es-ES");
const fmt0 = n => Math.round(n).toLocaleString("es-ES");

// liveWorld = la simulación; world = lo que se MUESTRA (puede ser una instantánea
// del pasado, de solo lectura). timeline guarda una copia por año para rebobinar.
let liveWorld, world;
let timeline = [], cursor = 0;
let playing = false, timer = null;
let scn = null; // escenario actual

// Preferencias del jugador en este navegador (escenarios superados)
const store = {
  get(k, d) { try { const v = localStorage.getItem("island." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("island." + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
};

const snap = () => JSON.parse(JSON.stringify(liveWorld));
const viewingPast = () => cursor < timeline.length - 1;
function recordSnapshot() {
  timeline.push(snap());
  if (timeline.length > 800) timeline.shift();
  cursor = timeline.length - 1;
  world = liveWorld;
}
function gotoCursor(i) {
  cursor = Math.max(0, Math.min(timeline.length - 1, i));
  world = viewingPast() ? timeline[cursor] : liveWorld;
  render();
}

// --- Controles --------------------------------------------------------------
function readSetup() {
  const num = (id, def) => {
    const v = parseInt($(id).value, 10);
    return Number.isFinite(v) && v >= 0 ? v : def;
  };
  return { children: num("initChildren", 4), adults: num("initAdults", 10), olds: num("initOlds", 2) };
}
function startScenario(id) {
  scn = SC.byId(id) || SC.SCENARIOS[0];
  store.set("scn", scn.id);
  // cada escenario empieza con sus medidas (la isla libre, con las de por defecto)
  liveWorld = newWorld(scn.free ? readSetup() : scn.setup);
  policyToUI();
  SC.start(scn, liveWorld);
  timeline = [snap()]; cursor = 0; world = liveWorld;
  stopPlay();
  closeModals();
  applyLayout();
  render();
}

// Un año de simulación + evaluación de la misión. Devuelve true si la misión acaba.
function simYear() {
  step(liveWorld);
  const ended = handleEvents(SC.update(scn, liveWorld, true));
  recordSnapshot();
  return ended || alive(liveWorld).length === 0;
}
function advance(n) {
  if (viewingPast()) { gotoCursor(timeline.length - 1); return; } // volver al presente
  for (let i = 0; i < n; i++) if (simYear()) break;
  render();
}
function handleEvents(events) {
  let ended = false;
  for (const e of events) {
    if (e.type === "phase") flash($("missionCard"));
    if (e.type === "won" || e.type === "lost") {
      ended = true;
      stopPlay();
      if (e.type === "won") { const d = store.get("done", []); if (!d.includes(scn.id)) store.set("done", [...d, scn.id]); }
      setTimeout(() => { render(); showResult(); }, 50);
    }
  }
  return ended;
}
function flash(el) {
  el.animate([{ boxShadow: "0 0 0 4px #e6a817" }, { boxShadow: "0 6px 20px rgba(0,0,0,.18)" }], { duration: 900 });
}

$("stepBtn").onclick = () => advance(1);
$("step10Btn").onclick = () => advance(10);
$("resetBtn").onclick = () => startScenario(scn.id);
$("newGameBtn").onclick = () => startScenario("free");
$("playBtn").onclick = () => playing ? stopPlay() : startPlay();
$("backBtn").onclick = () => { stopPlay(); gotoCursor(cursor - 1); };
$("fwdBtn").onclick = () => gotoCursor(cursor + 1);
$("presentBtn").onclick = () => gotoCursor(timeline.length - 1);
$("scnBtn").onclick = () => { stopPlay(); showScenarioPicker(); };
$("showAll").onchange = () => { applyLayout(); render(); };

function startPlay() {
  if (viewingPast()) gotoCursor(timeline.length - 1); // reanudar en el presente
  playing = true; $("playBtn").classList.add("active"); $("playBtn").textContent = "⏸ Pausa";
  timer = setInterval(() => {
    const ended = simYear(); render();
    if (ended) stopPlay();
  }, 450);
}
function stopPlay() {
  playing = false; $("playBtn").classList.remove("active"); $("playBtn").textContent = "⏩ Auto";
  if (timer) clearInterval(timer);
}

// Sliders de política (siempre actúan sobre la simulación viva)
const controlDefs = []; // { id, key, type, fmtFn } para volcar la política a la UI
function onPolicyChange() {
  if (!liveWorld || !scn) return;
  handleEvents(SC.update(scn, liveWorld, false)); // p. ej. «activa la imprenta»
  if (!viewingPast()) renderMission();
}
function bindSlider(id, key, fmtFn) {
  const el = $(id);
  const upd = () => {
    const v = parseFloat(el.value);
    if (liveWorld) liveWorld.policy[key] = v;
    $(id + "V").textContent = fmtFn(v);
  };
  el.oninput = () => { upd(); onPolicyChange(); };
  controlDefs.push({ id, key, type: "range", fmtFn });
}
function bindCheckbox(id, key) {
  const el = $(id);
  const upd = () => { if (liveWorld) liveWorld.policy[key] = el.checked; };
  el.onchange = () => { upd(); onPolicyChange(); };
  controlDefs.push({ id, key, type: "check" });
}
// Poner los controles con los valores de la política del mundo (al empezar un escenario)
function policyToUI() {
  for (const c of controlDefs) {
    const v = liveWorld.policy[c.key];
    if (c.type === "check") $(c.id).checked = !!v;
    else { $(c.id).value = v; $(c.id + "V").textContent = c.fmtFn(v); }
  }
}

// --- Qué se ve en cada escenario ---------------------------------------------
function applyLayout() {
  const all = scn.controls === "all";
  let anyCtl = false;
  document.querySelectorAll(".ctl").forEach(el => {
    const show = all || scn.controls.includes(el.dataset.ctl);
    el.classList.toggle("hidden", !show);
    anyCtl = anyCtl || show;
  });
  let first = true;
  document.querySelectorAll(".grp").forEach(g => {
    const vis = g.querySelector(".ctl:not(.hidden)");
    g.classList.toggle("hidden", !vis);
    g.classList.toggle("first", !!vis && first);
    if (vis) first = false;
  });
  $("noControls").classList.toggle("hidden", anyCtl);
  // en los escenarios guiados solo se ve lo esencial; el resto, a petición
  const showAll = scn.free || $("showAll").checked;
  $("showAllWrap").classList.toggle("hidden", !!scn.free);
  $("allData").classList.toggle("hidden", !showAll);
  document.querySelectorAll(".extra").forEach(el => el.classList.toggle("hidden", !showAll));
  $("treasuryCard").classList.toggle("hidden", !(showAll || scn.kpis.includes("treasury")));
  $("setupCard").classList.toggle("hidden", !scn.free);
  $("kpiLegend").innerHTML = scn.chart.map(([, label, color]) =>
    `<span><i class="key" style="background:${color}"></i>${label}</span>`).join("");
}
bindSlider("tax", "tax", v => Math.round(v) + "%");
bindSlider("pension", "pension", v => fmt(v));
bindSlider("ubi", "ubi", v => fmt(v));
bindCheckbox("allowPrint", "allowPrint");
bindCheckbox("shareSurplus", "shareSurplus");
bindSlider("interest", "interest", v => fmt(v) + "%");
bindSlider("quota", "quota", v => Math.round(v) + "%");
bindSlider("retireAge", "retireAge", v => Math.round(v) + " años");
bindCheckbox("womenWork", "womenWork");
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
  setRetireAge(w.policy.retireAge); // que stage() use la jubilación del mundo mostrado
  const living = alive(w);
  $("dayNum").textContent = w.day;
  $("season").textContent = w.drought > 0 ? "🌵 Sequía" :
    (w.abundance > 1.1 ? "🐟 Abundancia" : (w.abundance < 0.8 ? "🌧️ Escasez" : "⛅ Normal"));

  const st = w.stats || {};
  const f = w.flows || {};

  // --- Población y recursos ---
  $("pop").textContent = living.length;
  $("stock").textContent = fmt0(w.fishStock);
  const children = living.filter(p => stage(p) === "child").length;
  const adults = living.filter(p => stage(p) === "adult").length;
  const olds = living.filter(p => stage(p) === "old").length;
  $("ages").textContent = `${children} / ${adults} / ${olds}`;
  const freeH = w.houses.filter(h => h.ownerId === null).length;
  $("houses").textContent = `${w.houses.length} (${freeH})`;
  const noHouse = w.households.filter(h => !h.houseId).length;
  $("families").textContent = `${w.households.length} (${noHouse})`;
  const seaPct = Math.round((w.seaFish / CFG.SEA_CAPACITY) * 100);
  $("sea").innerHTML = `<span class="${seaPct < 40 ? "bad" : ""}">${seaPct}%</span> · ${fmt0(w.seaFish)}`;
  const demand = living.reduce((s, p) => s + need(p), 0);
  $("catch").textContent = `${fmt0(w.lastCatch)} / ${fmt0(demand)}`;
  $("quotaNote").textContent = w.quotaHit ? "⚠️ cuota de pesca alcanzada" : "";
  const workersN = living.filter(p => stage(p) === "adult" && (w.policy.womenWork || p.sex === "M")).length;
  $("work").textContent = `${Math.max(0, workersN - w.builders)} / ${w.builders}`;

  // --- Mercados ---
  $("priceFish").textContent = fmt(w.priceFish);
  const infl = st.inflation10 || 0;
  const pill = $("fishInfl");
  pill.textContent = (infl >= 0 ? "+" : "") + infl.toFixed(0) + "%";
  pill.className = "pill " + (infl > 3 ? "up" : (infl < -3 ? "down" : "flat"));
  const ratio = w.marketS > 0.01 ? w.marketD / w.marketS : 0;
  $("marketSD").textContent = `${fmt0(w.marketD)} / ${fmt0(w.marketS)} 🐟`;
  $("marketHint").textContent = ratio > 1.05 ? "falta pescado → el precio sube" :
    (ratio < 0.95 ? "sobra pescado → el precio baja" : "equilibrio");
  $("priceHouse").textContent = fmt0(w.priceHouse);
  $("houseFish").textContent = `≈ ${fmt0(w.priceHouse / w.priceFish)} 🐟`;
  $("money").textContent = fmt0(totalMoney(w));
  $("bankDeposits").textContent = fmt0(w.households.reduce((s, h) => s + (h.deposit || 0), 0) + (w.treasuryDeposit || 0));
  $("bankDebt").textContent = fmt0(w.households.reduce((s, h) => s + (h.debt || 0), 0));
  $("mortgages").textContent = `${w.mortgagesGranted || 0} / ${w.mortgagesDenied || 0}`;

  // --- Bienestar (medido en pescados: riqueza real) ---
  $("prodPerCap").textContent = fmt(st.prodPerCap || 0);
  $("wealthPerCap").textContent = fmt(st.wealthPerCap || 0);
  $("gini").textContent = (st.gini || 0).toFixed(2);
  $("poverty").innerHTML = `<span class="${(st.povertyRate || 0) > 20 ? "bad" : ""}">${Math.round(st.povertyRate || 0)}%</span>`;
  $("hunger10").innerHTML = `<span class="${(st.hungerDeaths10 || 0) > 5 ? "bad" : ""}">${st.hungerDeaths10 || 0}</span>`;
  $("immigrants").textContent = w.immigrants || 0;

  // --- Tesoro público (cuentas del año) ---
  $("treasury").textContent = fmt0(w.treasury);
  $("printed").textContent = `${fmt0(f.printed || 0)} / ${fmt0(w.moneyPrinted)}`;
  const rowsAcc = [
    ["➕ Impuestos de la lonja", f.taxes],
    ["➕ Venta de viviendas públicas", f.houseSales],
    ["➕ Herencias sin heredero", f.estates],
    ["➖ Pensiones y renta universal", -(f.welfare || 0)],
    ["➖ Obra pública (constructores)", -(f.works || 0)],
    ["➖ Reparto del superávit", -(f.dividend || 0)],
  ];
  const net = rowsAcc.reduce((s, r) => s + (r[1] || 0), 0);
  $("accounts").innerHTML = rowsAcc.map(([k, v]) => `<tr><td>${k}</td><td>${fmt(v || 0)}</td></tr>`).join("") +
    `<tr class="total"><td>Saldo del año</td><td class="${net < 0 ? "bad" : "good"}">${net >= 0 ? "+" : ""}${fmt(net)}</td></tr>`;
  $("cutNote").innerHTML = w.welfareCut > 0.5
    ? `<span class="bad">⚠️ No hay dinero: las ayudas se han recortado un ${Math.round(w.welfareCut)}%.</span> Sube impuestos o permite imprimir.`
    : "";

  // Log
  $("log").innerHTML = w.log.map(l => `<div>${l}</div>`).join("");

  // Estado de los controles de tiempo (modo solo lectura al ver el pasado)
  const past = viewingPast();
  $("pastBanner").style.display = past ? "" : "none";
  if (past) $("pastDay").textContent = "año " + w.day;
  $("stepBtn").disabled = false; // avanzar desde el pasado vuelve al presente
  $("backBtn").disabled = cursor <= 0;
  $("fwdBtn").disabled = !past;
  $("presentBtn").disabled = !past;
  $("backBtn").style.opacity = cursor <= 0 ? 0.5 : 1;
  $("fwdBtn").style.opacity = past ? 1 : 0.5;
  $("presentBtn").style.opacity = past ? 1 : 0.5;

  renderMission();
  renderKpis();
  drawIsland();
  drawCharts();
  if ($("view-pyramid").classList.contains("show")) drawPyramid();
  if ($("view-tree").classList.contains("show")) drawTree();
  if ($("view-people").classList.contains("show")) drawPeople();
}

// --- Misión del escenario ---------------------------------------------------
function renderMission() {
  const w = world, m = w.mission;
  if (!scn || !m) return;
  $("mIcon").textContent = scn.icon;
  $("mTitle").textContent = scn.title;
  $("mLesson").textContent = `${scn.level} · ${scn.lesson}`;
  $("mIntro").innerHTML = scn.intro;

  let task = "";
  if (m.status === "free") {
    task = `<div class="lbl">🧭 Sin objetivo</div>Experimenta: cambia una medida cada vez y
      mira qué pasa en los indicadores. Con <b>⏮</b> puedes volver atrás y comparar.`;
  } else if (m.status === "running") {
    const ph = scn.phases[m.phase];
    const pr = SC.progress(scn, w);
    task = `<div class="lbl">🎯 Tu misión · paso ${m.phase + 1} de ${scn.phases.length}</div>${ph.text}`;
    if (ph.type === "wait" && ph.keep && !ph.keep(w)) task += `<p class="bad" style="margin:6px 0 0">⚠️ ${ph.keepHint}</p>`;
    if (ph.type !== "action") {
      task += `<div class="bar"><i style="width:${Math.round(Math.min(1, pr.frac) * 100)}%"></i></div><div class="bar-l">${pr.label}</div>`;
    }
    if (ph.type === "goal") {
      const el = w.day - m.phaseStart;
      task += `<ul class="conds">` + ph.conds.map(c => {
        const ok = c.test(w);
        const pending = c.kind === "always" && el < (c.from || 0);
        const icon = ok ? "✅" : (pending || c.kind === "end" ? "⏳" : "❌");
        return `<li><span>${icon}</span><span>${c.text}</span><span class="cv ${ok ? "good" : "bad"}">${c.value(w)}</span></li>`;
      }).join("") + `</ul>`;
    }
  } else {
    const won = m.status === "won";
    const experiment = scn.phases.every(p => p.type !== "goal");
    task = `<div class="lbl">${won ? "🏁 Terminado" : "❌ Fallido"}</div>
      <div class="m-result ${won ? "won" : "lost"}">${won ? (experiment ? "🎓 Experimento completado" : "🏆 ¡Objetivo cumplido!") : "😞 " + m.failMsg}</div>
      <div class="m-actions">
        <button class="small" id="mSeeBtn">📘 Ver la lección</button>
        <button class="small ghost" id="mRetryBtn">↺ Reintentar</button>
        ${nextScenario() ? `<button class="small ghost" id="mNextBtn">➡ ${nextScenario().title}</button>` : ""}
      </div>`;
  }
  $("mTask").innerHTML = task;
  if ($("mSeeBtn")) $("mSeeBtn").onclick = showResult;
  if ($("mRetryBtn")) $("mRetryBtn").onclick = () => startScenario(scn.id);
  if ($("mNextBtn")) $("mNextBtn").onclick = () => startScenario(nextScenario().id);

  // lo aprendido en los pasos ya completados (el último, arriba)
  const done = m.done.filter(d => d.explain);
  $("mDone").innerHTML = done.length
    ? `<b>📘 Lo que ha pasado</b>` + done.slice().reverse().map(d => `<div class="step">${d.explain}</div>`).join("")
    : "";
}

function nextScenario() {
  const i = SC.SCENARIOS.indexOf(scn);
  return SC.SCENARIOS[i + 1] || null;
}

// --- Indicadores clave ------------------------------------------------------
function renderKpis() {
  const w = world;
  if (!scn) return;
  $("kpis").innerHTML = scn.kpis.map(k => {
    const d = SC.KPIS[k];
    const bad = d.bad && d.bad(w);
    return `<div class="stat ${bad ? "bad" : ""}"><div class="l">${d.label}</div><div class="v">${d.value(w)}</div>
      <div class="s">${d.sub ? d.sub(w) : ""}</div></div>`;
  }).join("");
  const h = w.history;
  if (h.length) lineChart($("chartKpi"), scn.chart.map(([key]) => h.map(d => d[key] || 0)), scn.chart.map(c => c[2]));
  else $("chartKpi").getContext("2d").clearRect(0, 0, $("chartKpi").width, $("chartKpi").height);
}

// --- Modales: selector de escenarios y resultado ----------------------------
function closeModals() { $("scnModal").classList.add("hidden"); $("resultModal").classList.add("hidden"); }
function showScenarioPicker() {
  const done = store.get("done", []);
  $("scnGrid").innerHTML = SC.SCENARIOS.map(s => `
    <button class="scn" data-id="${s.id}">
      <span class="ic">${s.icon}</span>
      <span class="t">${s.title}</span>
      <span class="le">${s.lesson}</span>
      <span class="lv"><span>${s.level}</span>${done.includes(s.id) ? `<span class="ok">✔ superado</span>` : ""}</span>
    </button>`).join("");
  $("scnGrid").querySelectorAll(".scn").forEach(b => { b.onclick = () => startScenario(b.dataset.id); });
  $("scnModal").classList.remove("hidden");
}
$("scnModal").onclick = e => { if (e.target === $("scnModal") && scn) closeModals(); };
$("resultModal").onclick = e => { if (e.target === $("resultModal")) closeModals(); };

function showResult() {
  const w = world, m = w.mission;
  if (!m || (m.status !== "won" && m.status !== "lost")) return;
  const won = m.status === "won";
  const experiment = scn.phases.every(p => p.type !== "goal");
  $("rIcon").textContent = won ? (experiment ? "🎓" : "🏆") : "😞";
  $("rTitle").textContent = won ? (experiment ? `${scn.title}: experimento completado` : `${scn.title}: ¡objetivo cumplido!`) : `${scn.title}: no lo has conseguido`;
  $("rSub").textContent = won ? `Año ${m.endDay}. Lo que has aprendido:` : m.failMsg;
  $("rBody").innerHTML = scn.conclusion ? scn.conclusion(w, m) : "";
  const nx = nextScenario();
  $("rActions").innerHTML = `
    ${nx ? `<button id="rNext">➡ Siguiente: ${nx.icon} ${nx.title}</button>` : ""}
    <button class="ghost" id="rRetry">↺ Reintentar</button>
    <button class="ghost" id="rMenu">🗺️ Escenarios</button>
    <button class="ghost" id="rStay">👁 Seguir mirando la isla</button>`;
  if (nx) $("rNext").onclick = () => startScenario(nx.id);
  $("rRetry").onclick = () => startScenario(scn.id);
  $("rMenu").onclick = () => { closeModals(); showScenarioPicker(); };
  $("rStay").onclick = closeModals;
  $("resultModal").classList.remove("hidden");
}

// --- Isla (SVG) -------------------------------------------------------------
function drawIsland() {
  const w = world;
  const svg = $("island");
  const W = 800, H = 420;
  const living = alive(w);

  let s = "";
  // mar
  s += `<rect width="${W}" height="${H}" fill="url(#seaGrad)"/>`;
  // isla (elipse de arena con hierba encima)
  s += `<ellipse cx="400" cy="300" rx="330" ry="150" fill="#e8d6a3"/>`;
  s += `<ellipse cx="400" cy="285" rx="300" ry="125" fill="#7bc86c"/>`;
  s += `<ellipse cx="400" cy="275" rx="250" ry="95" fill="#8fd47e"/>`;
  // palmeras decorativas (en las esquinas, fuera de la "aldea")
  for (const [px,py] of [[110,250],[700,255]]) {
    s += `<rect x="${px-3}" y="${py}" width="6" height="34" fill="#8a5a2b"/>`;
    s += `<circle cx="${px}" cy="${py}" r="16" fill="#3f9d4a"/>`;
  }

  // --- Disposición: cada casa en una cuadrícula y su familia alrededor ------
  const byId = new Map(w.people.map(p => [p.id, p]));
  const hhById = new Map(w.households.map(h => [h.id, h]));
  // casa en la que vive cada persona: la de su hogar; si su hogar no tiene casa
  // (pareja sin vivienda propia), viven en casa de los padres de alguno de ellos
  const parentsHouse = p => {
    if (!p || !p.parents) return null;
    for (const pid of p.parents) {
      const par = byId.get(pid);
      const phh = par && par.alive ? hhById.get(par.householdId) : null;
      if (phh && phh.houseId) return phh.houseId;
    }
    return null;
  };
  const houseOf = p => {
    const hh = hhById.get(p.householdId);
    if (hh && hh.houseId) return hh.houseId;
    if (hh) return parentsHouse(byId.get(hh.fatherId)) || parentsHouse(byId.get(hh.motherId)) || parentsHouse(p);
    return parentsHouse(p);
  };

  // posiciones de las casas en rejilla dentro de la isla verde. Preferimos una
  // rejilla ancha (máx. 2 filas) para que cada familia quepa debajo sin solaparse.
  const N = w.houses.length;
  const rows = N <= 5 ? 1 : 2;
  const cols = Math.max(1, Math.ceil(N / rows));
  const x0 = 165, x1 = 635, yTop = 222, yBot = 330;
  const cellW = (x1 - x0) / cols;
  const cellH = (yBot - yTop) / rows;
  const hpos = new Map();
  w.houses.forEach((h, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    hpos.set(h.id, { x: x0 + cellW * (c + 0.5), y: yTop + cellH * (r + 0.5) });
  });

  // agrupar residentes vivos por casa
  const residentsByHouse = new Map();
  const homeless = [];
  living.forEach(p => {
    const hid = houseOf(p);
    if (hid && hpos.has(hid)) {
      if (!residentsByHouse.has(hid)) residentsByHouse.set(hid, []);
      residentsByHouse.get(hid).push(p);
    } else {
      homeless.push(p);
    }
  });
  // orden dentro del hogar: adultos (padres) primero, luego niños/viejos
  const rank = p => (stage(p) === "adult" ? 0 : (stage(p) === "old" ? 1 : 2));

  // dibujar casas (con el apellido de la familia que vive en ellas)
  w.houses.forEach(h => {
    const pos = hpos.get(h.id);
    s += houseSVG(pos.x, pos.y - 8, h.ownerId !== null);
    const owner = h.ownerId ? byId.get(h.ownerId) : null;
    if (owner) {
      const fam = esc(owner.surname.split(" ")[0]);
      s += `<text x="${pos.x}" y="${pos.y - 20}" font-size="8" text-anchor="middle" font-weight="700" fill="#5a3a1f">${fam}</text>`;
    }
  });

  // dibujar a cada familia agrupada bajo su casa
  for (const [hid, res] of residentsByHouse) {
    const pos = hpos.get(hid);
    res.sort((a, b) => rank(a) - rank(b));
    const perRow = res.length <= 3 ? res.length : 3;
    res.forEach((p, k) => {
      const rr = Math.floor(k / perRow), cc = k % perRow;
      const inRow = Math.min(res.length - rr * perRow, perRow);
      const px = pos.x + (cc - (inRow - 1) / 2) * 15;
      const py = pos.y + 16 + rr * 15;
      s += personSVG(px, py, p);
    });
  }

  // sin hogar (solteros, huérfanos): en la playa inferior
  homeless.forEach((p, k) => {
    const perRow = 12;
    const rr = Math.floor(k / perRow), cc = k % perRow;
    const px = 150 + cc * 42;
    const py = 360 + rr * 18;
    s += personSVG(px, py, p);
  });

  const defs = `<defs>
    <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
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
  const hungry = p.hungryYears > 0;
  const stName = { child: "Niño", adult: "Adulto", old: "Viejo" }[st];
  let g = `<g>`;
  g += `<title>${esc(fullName(p))} · ${stName} · ${Math.floor(p.age)} años · hogar 🐚 ${fmt0(walletOf(world, p))}${hungry ? " · 🍽️ pasa hambre" : ""}</title>`;
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
    [h.map(d => d.pop), h.map(d => d.fishStock), h.map(d => d.seaFish)],
    ["#1f7a8c", "#3fa34d", "#2a7bb8"]);
  if ($("view-welfare").classList.contains("show")) {
    lineChart($("chartWelfare"),
      [h.map(d => d.wealthPerCap || 0), h.map(d => d.prodPerCap || 0), h.map(d => d.poverty || 0)],
      ["#3fa34d", "#1f7a8c", "#d8544f"]);
  }
}

// --- Tabla de habitantes ----------------------------------------------------
function drawPeople() {
  // ordenados por riqueza del hogar para ver de un vistazo las familias ricas
  const living = alive(world).sort((a, b) => walletOf(world, b) - walletOf(world, a));
  const stName = { child: "Niño", adult: "Adulto", old: "Viejo" };
  $("peopleBody").innerHTML = living.map(p => {
    const st = stage(p);
    const hh = hhOf(world, p);
    const state = p.hungryYears > 0 ? `🍽️ Hambre (${p.hungryYears} años)` :
      (p.building > 0 ? `🔨 Construye` :
      (p.partnerId ? (hh && !hh.houseId ? "🏚️ Casado, vive con sus padres" : "👨‍👩‍👧 Familia") : "Soltero"));
    return `<tr>
      <td>${fullName(p)} ${p.sex === "F" ? "♀" : "♂"}</td>
      <td>${Math.floor(p.age)}</td>
      <td>${stName[st]}</td>
      <td><b>🐚 ${fmt0(walletOf(world, p))}</b></td>
      <td>${state}</td></tr>`;
  }).join("");
}

// --- Pirámide poblacional ---------------------------------------------------
function drawPyramid() {
  const living = alive(world);
  const BAND = 10;
  const maxAge = living.length ? Math.max(10, ...living.map(p => Math.floor(p.age))) : 10;
  const nBands = Math.min(12, Math.floor(maxAge / BAND) + 1);
  // contar por franja y sexo
  const bands = [];
  let maxCount = 1;
  for (let b = 0; b < nBands; b++) {
    const lo = b * BAND, hi = lo + BAND - 1;
    const inBand = living.filter(p => Math.floor(p.age) >= lo && Math.floor(p.age) <= hi);
    const M = inBand.filter(p => p.sex === "M").length;
    const F = inBand.filter(p => p.sex === "F").length;
    maxCount = Math.max(maxCount, M, F);
    bands.push({ lo, hi, M, F });
  }

  const W = 440, rowH = 24, padTop = 8;
  const H = nBands * rowH + padTop + 24;
  const cx = W / 2, labelW = 54, maxBar = cx - labelW / 2 - 8;
  const retire = world.policy.retireAge;
  const stageColor = lo => lo < CFG.CHILD_MAX_AGE ? "#2a7bb8" : (lo < retire ? "#2e8b57" : "#7a5ba6");

  let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" style="max-height:360px">`;
  bands.forEach((bd, i) => {
    const y = padTop + (nBands - 1 - i) * rowH; // jóvenes abajo
    const mw = (bd.M / maxCount) * maxBar;
    const fw = (bd.F / maxCount) * maxBar;
    const by = y + 3, bh = rowH - 7;
    // barras
    if (bd.M > 0) svg += `<rect x="${cx - labelW / 2 - mw}" y="${by}" width="${mw}" height="${bh}" fill="#4a90d4" rx="2"/>`;
    if (bd.F > 0) svg += `<rect x="${cx + labelW / 2}" y="${by}" width="${fw}" height="${bh}" fill="#e07a9b" rx="2"/>`;
    // conteos
    if (bd.M > 0) svg += `<text x="${cx - labelW / 2 - mw - 3}" y="${y + rowH / 2 + 3}" font-size="9" text-anchor="end" fill="#20323f">${bd.M}</text>`;
    if (bd.F > 0) svg += `<text x="${cx + labelW / 2 + fw + 3}" y="${y + rowH / 2 + 3}" font-size="9" fill="#20323f">${bd.F}</text>`;
    // etiqueta de edad (coloreada por etapa)
    svg += `<text x="${cx}" y="${y + rowH / 2 + 3}" font-size="9" font-weight="700" text-anchor="middle" fill="${stageColor(bd.lo)}">${bd.lo}–${bd.hi}</text>`;
  });
  // cabecera
  svg += `<text x="${cx / 2}" y="${H - 6}" font-size="10" text-anchor="middle" fill="#6b7c89">♂ ${living.filter(p => p.sex === "M").length}</text>`;
  svg += `<text x="${cx + cx / 2}" y="${H - 6}" font-size="10" text-anchor="middle" fill="#6b7c89">♀ ${living.filter(p => p.sex === "F").length}</text>`;
  svg += `<text x="${cx}" y="${H - 6}" font-size="9" text-anchor="middle" fill="#6b7c89">edad</text>`;
  svg += `</svg>`;
  $("pyramid").innerHTML = svg;
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

  const NW = 96, NH = 46, GAPX = 16, GAPY = 82;
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
      <text x="${pp.x + NW / 2}" y="${pp.y + 39}" font-size="9" text-anchor="middle" fill="${p.alive ? "#b8860b" : "#9aa4ac"}">
        🐚 ${p.alive ? fmt0(walletOf(world, p)) : "—"}</text>
    </g>`;
  });
  svg += `</svg>`;
  $("tree").innerHTML = svg;
}

function esc(s) { return String(s).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])); }

// Iniciar: el último escenario jugado (o el tutorial) y el menú de escenarios
startScenario(store.get("scn", "intro"));
showScenarioPicker();
window.__world = () => world; // depuración
})();
