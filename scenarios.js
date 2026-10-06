/* ============================================================================
 * Island Simulator — escenarios guiados
 * Cada escenario enseña UNA lección: muestra solo sus controles y sus
 * indicadores clave, y tiene un objetivo. Sin DOM: la UI (app.js) lo pinta.
 * ==========================================================================*/
(function () {
const I = window.Island;

const last = w => w.history.length ? w.history[w.history.length - 1] : {};
const avgLast = (w, key, n) => {
  const h = w.history.slice(-n);
  return h.length ? h.reduce((s, d) => s + (d[key] || 0), 0) / h.length : 0;
};
// adultos y viejos vivos ahora mismo
const ages = w => {
  const living = I.alive(w);
  return { adults: living.filter(p => I.stage(p) === "adult").length, olds: living.filter(p => I.stage(p) === "old").length };
};
const seaPct = w => (w.seaFish / I.CFG.SEA_CAPACITY) * 100;
const fmt = n => (Math.round(n * 10) / 10).toLocaleString("es-ES");
const fmt0 = n => Math.round(n).toLocaleString("es-ES");
const fmt2 = n => (Math.round(n * 100) / 100).toLocaleString("es-ES");
// inflación «como en las noticias»: % al año, media de los últimos 10 años
const inflTxt = w => { const i = (w.stats || {}).inflationYear || 0; return `${i >= 0 ? "+" : ""}${fmt(i)}%`; };

// Foto de la economía en un momento dado (para comparar antes / después)
function snapshot(w) {
  const s = w.stats || {};
  return {
    day: w.day,
    price: w.priceFish,
    money: I.totalMoney(w),
    printed: w.moneyPrinted,
    ubiReal: w.policy.ubi / w.priceFish,
    pensionReal: w.policy.pension / w.priceFish,
    ubi: w.policy.ubi,
    pension: w.policy.pension,
    wealth: s.wealthPerCap || 0,
    prod: s.prodPerCap || 0,
    sea: seaPct(w),
    pop: I.alive(w).length,
  };
}

// ---------------------------------------------------------------------------
// Indicadores clave que un escenario puede mostrar
// ---------------------------------------------------------------------------
const KPIS = {
  price: { label: "Precio del pescado", value: w => `${fmt(w.priceFish)} 🐚`,
    sub: w => `inflación: ${inflTxt(w)} al año`,
    bad: w => ((w.stats || {}).inflationYear || 0) > 5 },
  inflation: { label: "Inflación", value: w => `${inflTxt(w)}`,
    sub: () => "al año (media de 10 años) · lo sano: 0–3%",
    bad: w => ((w.stats || {}).inflationYear || 0) > 5 },
  bankMoney: { label: "Dinero en la calle / en el banco", value: w => `${fmt0(I.totalMoney(w))} / ${fmt0(w.lendable || 0)}`,
    sub: () => "lo del banco sin prestar no se gasta" },
  money: { label: "Caracolas en la calle", value: w => fmt0(I.totalMoney(w)), sub: () => "dinero de las familias" },
  printed: { label: "Dinero impreso", value: w => fmt0(w.moneyPrinted), sub: () => "caracolas creadas en total" },
  ubiReal: { label: "Renta universal real", value: w => `${fmt2(w.policy.ubi / w.priceFish)} 🐟`,
    sub: w => `${fmt(w.policy.ubi)} 🐚 compran esos pescados` },
  pensionReal: { label: "Pensión real", value: w => `${fmt2(w.policy.pension / w.priceFish)} 🐟`,
    sub: w => `${fmt(w.policy.pension)} 🐚 compran esos pescados`, bad: w => w.policy.pension / w.priceFish < 0.5 },
  wealth: { label: "Riqueza por habitante", value: w => `${fmt((w.stats || {}).wealthPerCap || 0)} 🐟`, sub: () => "ahorro real, en pescados" },
  sea: { label: "Peces en el mar", value: w => `${Math.round(seaPct(w))}%`, sub: () => "de su capacidad", bad: w => seaPct(w) < 40 },
  catchPerCap: { label: "Pesca por habitante", value: w => `${fmt((w.stats || {}).prodPerCap || 0)} 🐟`, sub: () => "al año (un adulto come 2)" },
  hunger10: { label: "Muertes por hambre", value: w => fmt0((w.stats || {}).hungerDeaths10 || 0), sub: () => "últimos 10 años",
    bad: w => ((w.stats || {}).hungerDeaths10 || 0) > 5 },
  pop: { label: "Habitantes", value: w => fmt0(I.alive(w).length), sub: w => { const c = ages(w); return `${c.adults} adultos · ${c.olds} viejos`; } },
  treasury: { label: "Tesoro público", value: w => `${fmt0(w.treasury)} 🐚`, sub: w => `impuestos este año: ${fmt0((w.flows || {}).taxes || 0)}` },
  cut: { label: "Recorte de ayudas", value: w => `${Math.round(w.welfareCut || 0)}%`, sub: () => "lo que el tesoro no puede pagar",
    bad: w => (w.welfareCut || 0) > 20 },
  dependency: { label: "Viejos por trabajador", value: w => { const c = ages(w); return fmt2(c.olds / Math.max(1, c.adults)); },
    sub: () => "cuántos mantiene cada adulto" },
  mortgages: { label: "Hipotecas concedidas", value: w => fmt0(w.mortgagesGranted || 0),
    sub: w => `denegadas: ${w.deniedCantPay || 0} no pueden pagar · ${w.deniedNoFunds || 0} sin ahorro en el banco` },
  lendable: { label: "Ahorro en el banco sin prestar", value: w => `${fmt0(w.lendable || 0)} 🐚`,
    sub: w => `una casa cuesta ${fmt0(w.priceHouse)} 🐚`, bad: w => (w.lendable || 0) < w.priceHouse },
  noHouse: { label: "Parejas sin casa", value: w => fmt0(last(w).noHouse || 0), sub: () => "viven con sus padres", bad: w => (last(w).noHouse || 0) > 3 },
  rentiers: { label: "Rentistas 🎩", value: w => fmt0(last(w).rentiers || 0),
    sub: w => `adultos que viven de sus ahorros · intereses este año: ${fmt0((w.flows || {}).interest || 0)} 🐚` },
  births10: { label: "Nacimientos", value: w => fmt0((w.stats || {}).births10 || 0), sub: () => "últimos 10 años" },
  poverty: { label: "Pobreza", value: w => `${Math.round((w.stats || {}).povertyRate || 0)}%`, sub: () => "no cubren su comida",
    bad: w => ((w.stats || {}).povertyRate || 0) > 20 },
};

// ---------------------------------------------------------------------------
// Escenarios
// ---------------------------------------------------------------------------
const SCENARIOS = [
  {
    id: "intro", icon: "🏝️", title: "Primeros pasos", lesson: "Cómo funciona la isla",
    level: "Tutorial",
    intro: `Una isla con unas pocas familias. Los adultos <b>pescan</b>: cada familia come
      primero de lo que pesca y <b>vende lo que le sobra</b> en la lonja. Quien no pesca
      (niños y viejos) <b>compra</b> con caracolas 🐚, la moneda de la isla.`,
    setup: { children: 4, adults: 10, olds: 2, stableClimate: true },
    controls: [],
    kpis: ["pop", "price", "catchPerCap", "wealth"],
    chart: [["pop", "Población", "#1f7a8c"], ["priceFish", "Precio del pescado", "#d8544f"]],
    phases: [
      { type: "action", text: "Pulsa <b>▶ Avanzar año</b> para que pase el primer año.",
        done: w => w.day >= 1,
        explain: `Ha pasado un año. Los adultos han pescado, las familias han comido y lo
          que sobraba se ha vendido en la lonja. Mira el precio del pescado: sale de la
          <b>oferta y la demanda</b>.` },
      { type: "wait", years: 15, text: "Deja que pasen <b>15 años</b> (usa <b>⏭ +10 años</b> o <b>⏩ Auto</b>). Fíjate en cómo crece la población.",
        explain: `Las familias que comen bien y ahorran tienen hijos, y a los 10 años esos
          hijos ya pescan. Mientras haya peces de sobra, la isla crece.` },
    ],
    conclusion: (w, m) => `
      <p>La isla funciona sola: <b>trabajo → pescado → comida y ahorro → hijos</b>.
      El precio del pescado ha pasado de ${fmt(m.marks.start.price)} a ${fmt(w.priceFish)} 🐚
      según hubiera más o menos pescado que gente queriendo comprarlo.</p>
      <p>Ahora te toca gobernar. Cada escenario te enseña <b>una</b> idea de economía.
      Empieza por <b>🖨️ La imprenta</b>.</p>`,
  },
  {
    id: "print", icon: "🖨️", title: "La imprenta", lesson: "Imprimir dinero → inflación",
    level: "Experimento",
    intro: `Los isleños piden una <b>renta universal</b>: unas caracolas al año para cada
      habitante. El tesoro no tiene para pagarla… pero el gobierno tiene una
      <b>imprenta de caracolas</b>. ¿Serán todos más ricos?`,
    setup: { children: 4, adults: 10, olds: 2, stableClimate: true, warmup: 12 },
    controls: ["ubi", "allowPrint"],
    kpis: ["price", "money", "ubiReal", "wealth"],
    chart: [["priceFish", "Precio del pescado", "#d8544f"], ["money", "Caracolas en la calle", "#e6a817"], ["ubiReal", "Renta universal real (🐟)", "#3fa34d"]],
    phases: [
      { type: "action", text: "Activa <b>🖨️ Imprimir dinero</b> y sube la <b>🧺 Renta universal</b> a <b>3</b> o más.",
        done: w => w.policy.allowPrint && w.policy.ubi >= 3, mark: "start",
        explain: `La imprenta está en marcha: cada año se crean caracolas nuevas para
          pagar la renta universal. Ahora hay <b>más dinero</b>… pero el mismo pescado.` },
      { type: "wait", years: 25, keep: w => w.policy.allowPrint && w.policy.ubi >= 3,
        keepHint: "Para seguir el experimento, deja la imprenta encendida y la renta universal en 3 o más.",
        text: "Deja la imprenta funcionando <b>25 años</b> y observa el precio del pescado.", mark: "end" },
    ],
    conclusion: (w, m) => {
      const a = m.marks.start, b = m.marks.end || snapshot(w);
      const x = v => `×${fmt(v)}`;
      return `
      <table class="cmp"><tr><th></th><th>Al empezar</th><th>25 años después</th></tr>
        <tr><td>Caracolas en la calle</td><td>${fmt0(a.money)}</td><td>${fmt0(b.money)} <small>(${x(b.money / Math.max(1, a.money))})</small></td></tr>
        <tr><td>Precio del pescado</td><td>${fmt(a.price)} 🐚</td><td>${fmt(b.price)} 🐚 <small>(${x(b.price / a.price)})</small></td></tr>
        <tr><td>La renta universal compra</td><td>${fmt2(a.ubiReal)} 🐟</td><td>${fmt2(b.ubiReal)} 🐟</td></tr>
        <tr><td>La pensión compra</td><td>${fmt2(a.pensionReal)} 🐟</td><td>${fmt2(b.pensionReal)} 🐟</td></tr>
        <tr><td>Riqueza real por habitante</td><td>${fmt(a.wealth)} 🐟</td><td>${fmt(b.wealth)} 🐟</td></tr>
      </table>
      <p>Imprimir caracolas <b>no crea pescado</b>. Con más dinero persiguiendo la misma
      comida, los precios suben: es la <b>inflación</b>. La renta universal sigue siendo
      de ${fmt(b.ubi)} 🐚, pero cada vez compra menos. Y los más perjudicados son los que
      cobran una cantidad fija, como los <b>pensionistas</b>.</p>
      <p>💡 Prueba en <b>🏝️ Isla libre</b> a pagar la renta universal <b>sin imprimir</b>:
      verás que el tesoro no llega y hay que recortarla. No existe la renta gratis.</p>`;
    },
  },
  {
    id: "sea", icon: "🎣", title: "El mar", lesson: "La tragedia de los comunes",
    level: "Reto",
    intro: `El mar es de todos. Los pescadores pueden sacar hasta el <b>30%</b> de los peces
      cada año y hay comida de sobra… por ahora. Pero los peces necesitan tiempo para
      reproducirse.`,
    setup: { children: 12, adults: 20, olds: 2, stableClimate: true, policy: { quota: 30 } },
    controls: ["quota"],
    kpis: ["sea", "catchPerCap", "pop", "hunger10"],
    chart: [["seaFish", "Peces en el mar", "#2a7bb8"], ["pop", "Población", "#1f7a8c"], ["hunger10", "Muertes por hambre (10 años)", "#d8544f"]],
    phases: [
      { type: "goal", years: 60, text: "Llega al <b>año 60</b> con el mar sano y sin hambrunas.",
        conds: [
          { kind: "always", text: "El mar nunca baja del 20%", test: w => seaPct(w) >= 20,
            value: w => `${Math.round(seaPct(w))}%`,
            fail: "El mar se ha agotado: ya no quedan peces suficientes para reproducirse." },
          { kind: "end", text: "Al final, el mar por encima del 40%", test: w => seaPct(w) >= 40,
            value: w => `${Math.round(seaPct(w))}%` },
          { kind: "end", text: "Al final, menos de 15 muertes por hambre en 10 años",
            test: w => ((w.stats || {}).hungerDeaths10 || 0) < 15, value: w => fmt0((w.stats || {}).hungerDeaths10 || 0) },
        ] },
    ],
    conclusion: (w, m) => m.status === "won" ? `
      <p>¡Lo has conseguido! El mar está al ${Math.round(seaPct(w))}%.</p>
      <p>Cada pescador, por su cuenta, gana pescando más. Pero si todos lo hacen, el mar
      se vacía y pierden todos: es la <b>tragedia de los comunes</b>. Una <b>cuota</b>
      (como en la pesca real) pone un límite que nadie pondría por sí solo.</p>
      <p>Fíjate también en que, aunque el mar esté sano, la isla no puede crecer sin fin:
      el mar da para unas 65 personas. Cuando se llega a ese límite el pescado escasea y
      su precio sube (<b>inflación por escasez</b>), sin que nadie imprima dinero.</p>` : `
      <p>Con una cuota tan alta se pesca más de lo que el mar repone. Durante años parece
      que no pasa nada… hasta que el mar se vacía de golpe, la pesca cae y llega el hambre.</p>
      <p>Es la <b>tragedia de los comunes</b>: lo que es de todos se agota si nadie pone
      límites. Prueba a <b>bajar la cuota</b> pronto (entre el 8% y el 12% es sostenible).</p>`,
  },
  {
    id: "pensions", icon: "👴", title: "Las pensiones", lesson: "Envejecimiento y gasto público",
    level: "Reto",
    intro: `La isla está <b>envejecida</b>: hay más viejos que adultos trabajando. Las
      pensiones se pagan con los <b>impuestos</b> de la lonja, y el tesoro está casi vacío.`,
    setup: { children: 2, adults: 8, olds: 12, treasury: 150, stableClimate: true,
      policy: { pension: 3, tax: 10, retireAge: 55 } },
    controls: ["pension", "tax", "retireAge"],
    kpis: ["cut", "treasury", "dependency", "pensionReal"],
    chart: [["welfareCut", "Recorte de ayudas %", "#d8544f"], ["treasury", "Tesoro", "#e6a817"], ["olds", "Viejos", "#7a5ba6"], ["workers", "Adultos", "#2e8b57"]],
    phases: [
      { type: "goal", years: 40, text: "Paga las pensiones durante <b>40 años</b> sin recortes (y sin imprenta: aquí solo hay impuestos).",
        conds: [
          { kind: "always", from: 8, text: "Desde el año 8, los recortes nunca superan el 20%",
            test: w => (w.welfareCut || 0) <= 20, value: w => `${Math.round(w.welfareCut || 0)}%`,
            fail: "El tesoro no ha podido pagar las pensiones y se han recortado." },
          { kind: "end", text: "Al final, pensión de 2 🐚 o más", test: w => w.policy.pension >= 2,
            value: w => `${fmt(w.policy.pension)} 🐚` },
        ] },
    ],
    conclusion: (w, m) => `
      ${m.status === "won" ? "<p>¡Pensiones garantizadas!</p>" : ""}
      <p>Con pocos trabajadores y muchos jubilados, los impuestos no alcanzan para las
      pensiones. Solo hay tres salidas, y todas tienen un coste:</p>
      <ul>
        <li><b>Subir impuestos</b>: los que trabajan se quedan con menos.</li>
        <li><b>Retrasar la jubilación</b>: más gente trabajando y pagando, menos cobrando.</li>
        <li><b>Bajar la pensión</b>: los viejos viven peor.</li>
      </ul>
      <p>Fíjate en la gráfica: con el tiempo los viejos mueren y los niños crecen, y la
      carga se alivia sola. El problema de las pensiones es, sobre todo, un problema de
      <b>pirámide de población</b>.</p>`,
  },
  {
    id: "bank", icon: "🏦", title: "El banco", lesson: "Tipos de interés, vivienda y natalidad",
    level: "Reto",
    intro: `Una isla <b>joven</b>: muchos niños que pronto querrán casarse y tener casa propia.
      Para comprarla piden una <b>hipoteca</b> al banco. Pero el banco no tiene dinero
      propio: presta los <b>ahorros de otras familias</b>, que solo se los dejan si a
      cambio cobran intereses. El tipo de interés está en el <b>12%</b>.`,
    setup: { children: 10, adults: 6, olds: 2, stableClimate: true, policy: { interest: 12 } },
    controls: ["interest"],
    kpis: ["mortgages", "lendable", "noHouse", "rentiers"],
    chart: [["noHouse", "Parejas sin casa", "#d8544f"], ["lendable", "Ahorro en el banco sin prestar", "#e6a817"], ["pop", "Población", "#1f7a8c"]],
    phases: [
      { type: "goal", years: 40, text: "Llega al <b>año 40</b> con las parejas jóvenes en su propia casa.",
        conds: [
          { kind: "end", text: "Al final, de media 3 parejas o menos sin casa (últimos 10 años)",
            test: w => avgLast(w, "noHouse", 10) <= 3, value: w => fmt(avgLast(w, "noHouse", 10)) },
          { kind: "end", text: "Al final, 45 habitantes o más", test: w => I.alive(w).length >= 45,
            value: w => fmt0(I.alive(w).length) },
        ] },
    ],
    conclusion: (w, m) => `
      ${m.status === "won" ? "<p>¡Las parejas jóvenes tienen casa!</p>" : ""}
      <p>El <b>tipo de interés</b> es el precio del dinero prestado, y tiene dos lados:</p>
      <ul>
        <li><b>Muy alto</b>: la cuota de la hipoteca es más de lo que una pareja puede pagar.
          El banco se la deniega y tienen que <b>vivir con sus padres</b>, donde tienen menos hijos.</li>
        <li><b>Muy bajo</b>: a los ahorradores no les compensa prestar sus caracolas y las
          guardan en casa. El banco se queda <b>sin dinero que prestar</b> y tampoco hay hipotecas.</li>
      </ul>
      <p>El buen tipo de interés es el que equilibra a los dos lados: lo bastante alto para que
      los ahorradores presten y lo bastante bajo para que las parejas puedan pagar. Es el mismo
      equilibrio de <b>oferta y demanda</b> que el del pescado, pero con el dinero.</p>
      <p>🎩 Los intereses que pagan los hipotecados los cobran los ahorradores. Las familias
      con muchos ahorros pueden incluso <b>dejar de trabajar</b> y vivir de ellos: son los
      <b>rentistas</b>. Viven en las mansiones de la isla, pero no pescan, así que hay menos
      pescado para todos.</p>
      <p>En tu partida: <b>${w.mortgagesGranted}</b> hipotecas concedidas; denegadas
      <b>${w.deniedCantPay || 0}</b> porque la pareja no podía pagar y <b>${w.deniedNoFunds || 0}</b>
      porque el banco no tenía ahorro.</p>`,
  },
  {
    id: "central", icon: "🏛️", title: "El banco central", lesson: "Tipos de interés contra la inflación",
    level: "Reto",
    intro: `El gobierno anterior <b>imprimió caracolas sin control</b>: cada familia tiene el
      triple de dinero… pero el mar da el mismo pescado. Los precios están a punto de
      dispararse. Tú diriges el <b>banco central</b> y solo tienes una herramienta: el
      <b>tipo de interés</b>.`,
    setup: { children: 4, adults: 10, olds: 2, stableClimate: true, moneyMult: 3, policy: { interest: 3 } },
    controls: ["interest"],
    kpis: ["inflation", "bankMoney", "price", "pop"],
    chart: [["inflationYear", "Inflación % al año", "#d8544f"], ["money", "Dinero en la calle", "#e6a817"], ["pop", "Población", "#1f7a8c"]],
    phases: [
      { type: "goal", years: 40, text: "Durante <b>40 años</b>, mantén la inflación a raya… sin hundir la economía.",
        conds: [
          { kind: "always", from: 12, text: "Desde el año 12, la inflación nunca pasa del 5% al año",
            test: w => ((w.stats || {}).inflationYear || 0) <= 5, value: w => `${inflTxt(w)}`,
            fail: "La inflación se ha desbocado: los precios suben más de un 5% al año." },
          { kind: "end", text: "Al final, 25 habitantes o más (no hundas la economía)", test: w => I.alive(w).length >= 25,
            value: w => fmt0(I.alive(w).length) },
        ] },
    ],
    conclusion: (w, m) => `
      ${m.status === "won" ? "<p>¡Inflación controlada!</p>" : ""}
      <p>Cuando hay demasiado dinero para el pescado que existe, los precios suben. El banco
      central no puede «desimprimir» ese dinero, pero puede hacer que <b>no se gaste</b>:</p>
      <ul>
        <li><b>Subir los tipos</b>: ahorrar en el banco paga más, así que las familias meten allí
          sus caracolas en vez de gastarlas. Hay menos dinero en la calle y los precios se enfrían.
          Pero las hipotecas son más caras: se forman menos familias y nacen menos niños.</li>
        <li><b>Bajarlos demasiado pronto</b>: el dinero guardado vuelve a la calle de golpe y la
          inflación rebrota.</li>
      </ul>
      <p>Así trabajan los bancos centrales de verdad: buscan el tipo justo para frenar los
      precios sin ahogar la economía. Por eso se dice que la inflación es, sobre todo, un
      fenómeno <b>monetario</b>: trabajar más ayuda, pero despacio.</p>`,
  },
  {
    id: "free", icon: "🧭", title: "Isla libre", lesson: "Todas las medidas a la vez",
    level: "Sandbox", free: true,
    intro: `Todas las medidas y todos los datos. Con clima real: estaciones, años de
      abundancia y sequías. Elige la población inicial y gobierna como quieras.`,
    setup: null,
    controls: "all",
    kpis: ["price", "wealth", "poverty", "hunger10"],
    chart: [["priceFish", "Precio del pescado", "#d8544f"], ["pop", "Población", "#1f7a8c"], ["seaFish", "Peces en el mar", "#2a7bb8"]],
    phases: [],
  },
];

// ---------------------------------------------------------------------------
// Motor de misiones: el estado vive en w.mission (se guarda con el histórico)
// ---------------------------------------------------------------------------
function start(scn, w) {
  // algunos escenarios empiezan con unos años ya vividos, para que los precios
  // estén asentados y el experimento no se mezcle con el arranque de la isla
  const warm = (scn.setup && scn.setup.warmup) || 0;
  for (let i = 0; i < warm; i++) I.step(w);
  w.mission = { id: scn.id, phase: 0, phaseStart: w.day, waited: 0, status: scn.phases.length ? "running" : "free",
    marks: { start: snapshot(w) }, done: [], failMsg: "" };
  // una fase de acción ya cumplida al empezar avanza sola
  update(scn, w, false);
  return w.mission;
}

// Evalúa la misión. `stepped` = ha pasado un año (si no, solo se cambió un control).
// Devuelve una lista de eventos: { type: "phase" | "won" | "lost", ... }
function update(scn, w, stepped) {
  const m = w.mission;
  const ev = [];
  if (!m || m.status !== "running") return ev;
  for (let guard = 0; guard < 5 && m.status === "running"; guard++) {
    const ph = scn.phases[m.phase];
    if (!ph) { finish(scn, w, "won", ev); break; }
    let completed = false;
    if (ph.type === "action") {
      completed = ph.done(w);
    } else if (ph.type === "wait") {
      if (stepped && guard === 0) { if (!ph.keep || ph.keep(w)) m.waited++; }
      completed = m.waited >= ph.years;
    } else if (ph.type === "goal") {
      const el = w.day - m.phaseStart;
      for (const c of ph.conds) {
        if (c.kind === "always" && el >= (c.from || 0) && !c.test(w)) {
          m.failMsg = c.fail || c.text; finish(scn, w, "lost", ev); return ev;
        }
      }
      if (el >= ph.years) {
        const bad = ph.conds.filter(c => c.kind === "end" && !c.test(w));
        if (bad.length) { m.failMsg = "No se ha cumplido: " + bad.map(c => c.text.toLowerCase()).join("; ") + "."; finish(scn, w, "lost", ev); return ev; }
        completed = true;
      }
    }
    if (!completed) break;
    if (ph.mark) m.marks[ph.mark] = snapshot(w);
    m.done.push({ text: ph.text, explain: ph.explain || "" });
    ev.push({ type: "phase", phase: m.phase, explain: ph.explain || "" });
    m.phase++; m.phaseStart = w.day; m.waited = 0;
    stepped = false; // los años ya contados no cuentan para la fase siguiente
  }
  return ev;
}

function finish(scn, w, status, ev) {
  const m = w.mission;
  m.status = status;
  m.endDay = w.day;
  ev.push({ type: status });
}

// Progreso de la fase actual, para la barra (0..1) y texto
function progress(scn, w) {
  const m = w.mission;
  if (!m) return null;
  const ph = scn.phases[m.phase];
  if (!ph) return { frac: 1, label: "" };
  if (ph.type === "wait") return { frac: m.waited / ph.years, label: `${m.waited} / ${ph.years} años` };
  if (ph.type === "goal") { const el = w.day - m.phaseStart; return { frac: el / ph.years, label: `año ${el} de ${ph.years}` }; }
  return { frac: 0, label: "" };
}

window.Scenarios = { SCENARIOS, KPIS, start, update, progress, snapshot, byId: id => SCENARIOS.find(s => s.id === id) };
})();
