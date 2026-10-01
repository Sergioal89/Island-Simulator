/* ============================================================================
 * Island Simulator — Motor de simulación
 * ----------------------------------------------------------------------------
 * PoC educativo sobre conceptos económicos: inflación / deflación, oferta y
 * demanda, política monetaria (pensiones, renta universal) y dos mercados
 * (pescado y vivienda) que se mueven por los participantes.
 *
 * Economía en una frase:
 *   - El PESCADO es el bien real (producción). Los adultos lo producen.
 *   - La CARACOLA es el dinero. El gobierno (el jugador) puede "imprimir"
 *     caracolas vía pensiones y renta universal.
 *   - Precio ≈ Dinero en circulación / Bienes disponibles  (teoría cuantitativa:
 *     M·V = P·Q). Imprimir dinero sin producir más pescado => inflación.
 *     Producir más pescado con dinero fijo => deflación.
 * ==========================================================================*/

// ---------------------------------------------------------------------------
// Parámetros del mundo (ajustables)
// ---------------------------------------------------------------------------
const CFG = {
  // Demografía
  LIFESPAN_MIN: 80,
  LIFESPAN_MAX: 110,
  CHILD_MAX_AGE: 20,     // 0-20 => niño
  ADULT_MAX_AGE: 60,     // 20-60 => adulto, >60 => viejo
  FERTILE_MAX_AGE: 52,   // la madre deja de concebir pasada esta edad
  BIRTH_CHANCE: 0.25,    // prob. diaria de tener un hijo (pareja fértil con casa)
  BIRTH_COOLDOWN: 6,     // días mínimos entre hijos
  STARVE_DAYS: 3,        // días seguidos sin comer => muerte por inanición

  // Consumo (pescado/día)
  NEED_CHILD: 1,
  NEED_ADULT: 2,
  NEED_OLD: 1,

  // Producción
  BASE_CATCH: 4,         // pescado base por adulto pescador y día
                         // (debe superar el consumo de por vida: un habitante
                         //  es dependiente de niño y de viejo, así que cada
                         //  adulto tiene que producir bastante más de lo que come)
  HOUSE_BUILD_DAYS: 20,  // días de trabajo de 1 adulto para una casa

  // Dinero / mercados
  START_CARACOLAS: 50,   // caracolas iniciales por habitante
  START_FISH_STOCK: 60,  // stock inicial en la lonja
  START_HOUSES: 5,       // casas iniciales
  VELOCITY: 0.30,        // "V" de MV=PQ para el precio del pescado
  PRICE_ADJUST: 0.25,    // velocidad con la que el precio tiende al fundamental
  HOUSE_BASE_PRICE: 120, // precio de referencia de una vivienda
  HOUSE_ADJUST: 0.15,

  // Estación / clima
  SEASON_PERIOD: 40,     // días por ciclo estacional (abundancia<->sequía)
  DROUGHT_CHANCE: 0.015, // prob. diaria de evento de sequía
};

// Nombres y apellidos españoles para dar vida al árbol genealógico
const NAMES_M = ["Mateo","Hugo","Martín","Lucas","Leo","Daniel","Álvaro","Pablo","Marcos","Diego","Bruno","Gael","Nicolás","Adrián","Enzo","Mario","Thiago","Izan","Liam","Dylan"];
const NAMES_F = ["Lucía","Sofía","Martina","María","Julia","Paula","Emma","Daniela","Valeria","Alba","Carla","Noa","Vega","Olivia","Chloe","Sara","Candela","Jimena","Ana","Lola"];
const SURNAMES = ["García","Fernández","Rodríguez","López","Martínez","Sánchez","Pérez","Gómez","Marín","Torres","Ramos","Vargas","Castro","Rubio","Serrano","Molina","Ortega","Delgado","Navarro","Mar"];

let _idSeq = 1;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------------------
// Habitante
// ---------------------------------------------------------------------------
function makePerson({ age = 0, sex, firstName, surname, parents = null, caracolas = 0 }) {
  sex = sex || (Math.random() < 0.5 ? "M" : "F");
  return {
    id: _idSeq++,
    firstName: firstName || (sex === "M" ? pick(NAMES_M) : pick(NAMES_F)),
    surname: surname || `${pick(SURNAMES)} ${pick(SURNAMES)}`,
    sex,
    age,                       // en días
    lifespan: rndInt(CFG.LIFESPAN_MIN, CFG.LIFESPAN_MAX),
    caracolas,                 // los recién nacidos empiezan a 0 (los mantiene la familia)
    alive: true,
    deathCause: null,
    daysHungry: 0,
    partnerId: null,
    parents,                   // [idPadre, idMadre] o null (fundador)
    childrenIds: [],
    houseId: null,             // casa que ocupa (para formar familia)
    building: 0,               // progreso de construcción (0..HOUSE_BUILD_DAYS)
    lastBirthDay: -9999,
    // posición en la isla (para el render)
    x: rnd(0.15, 0.85),
    y: rnd(0.35, 0.85),
  };
}

function stage(p) {
  if (p.age < CFG.CHILD_MAX_AGE) return "child";
  if (p.age < CFG.ADULT_MAX_AGE) return "adult";
  return "old";
}
function need(p) {
  const s = stage(p);
  return s === "adult" ? CFG.NEED_ADULT : (s === "old" ? CFG.NEED_OLD : CFG.NEED_CHILD);
}

// ---------------------------------------------------------------------------
// Estado del mundo
// ---------------------------------------------------------------------------
function newWorld() {
  _idSeq = 1;
  const people = [];

  // 4 parejas fundadoras + algún soltero + varios niños
  const NUM_COUPLES = 4;
  for (let i = 0; i < NUM_COUPLES; i++) {
    const sur1 = `${pick(SURNAMES)} ${pick(SURNAMES)}`;
    const sur2 = `${pick(SURNAMES)} ${pick(SURNAMES)}`;
    // edades escalonadas para evitar que toda la cohorte envejezca a la vez
    const baseAge = rndInt(20, 45);
    const dad = makePerson({ age: baseAge, sex: "M", surname: sur1, caracolas: CFG.START_CARACOLAS });
    const mom = makePerson({ age: Math.max(20, baseAge + rndInt(-3, 3)), sex: "F", surname: sur2, caracolas: CFG.START_CARACOLAS });
    dad.partnerId = mom.id; mom.partnerId = dad.id;
    people.push(dad, mom);
  }
  // 2 adultos solteros
  people.push(makePerson({ age: rndInt(22, 35), sex: "M", caracolas: CFG.START_CARACOLAS }));
  people.push(makePerson({ age: rndInt(22, 35), sex: "F", caracolas: CFG.START_CARACOLAS }));
  // 4 niños de edades variadas (repartidos entre las parejas)
  for (let i = 0; i < 4; i++) {
    const dad = people[(i % NUM_COUPLES) * 2], mom = people[(i % NUM_COUPLES) * 2 + 1];
    const child = makePerson({
      age: rndInt(1, 18), parents: [dad.id, mom.id],
      surname: `${dad.surname.split(" ")[0]} ${mom.surname.split(" ")[0]}`,
    });
    dad.childrenIds.push(child.id); mom.childrenIds.push(child.id);
    child.lastBirthDay = 0;
    people.push(child);
  }

  const houses = [];
  for (let i = 0; i < CFG.START_HOUSES; i++) {
    houses.push({ id: i + 1, ownerId: null, builtDay: 0,
      x: rnd(0.2, 0.8), y: rnd(0.3, 0.6) });
  }
  // emparejar las parejas fundadoras con casas
  for (let i = 0; i < Math.min(NUM_COUPLES, houses.length); i++) {
    houses[i].ownerId = people[i * 2].id;
    people[i * 2].houseId = houses[i].id;
    people[i * 2 + 1].houseId = houses[i].id;
  }

  return {
    day: 0,
    people,
    houses,
    nextHouseId: houses.length + 1,
    fishStock: CFG.START_FISH_STOCK,
    priceFish: 2.0,
    priceHouse: CFG.HOUSE_BASE_PRICE,
    prevPriceFish: 2.0,
    abundance: 1.0,       // multiplicador de pesca
    drought: 0,           // días restantes de sequía
    // políticas (controladas por el jugador)
    policy: { pension: 0, ubi: 0, buildersPct: 0.15 },
    // acumuladores para la UI
    moneyPrinted: 0,      // caracolas creadas en total por el gobierno
    log: [],
    history: [],          // series temporales para gráficas
  };
}

function alive(w) { return w.people.filter(p => p.alive); }
function totalMoney(w) { return alive(w).reduce((s, p) => s + p.caracolas, 0); }

// Fondos a los que puede recurrir un habitante: él mismo + pareja + padres
function householdSupporters(w, p) {
  const out = [p];
  if (p.partnerId) { const q = w.people.find(x => x.id === p.partnerId); if (q && q.alive) out.push(q); }
  if (p.parents) for (const pid of p.parents) {
    const par = w.people.find(x => x.id === pid); if (par && par.alive) out.push(par);
  }
  return out;
}
function householdFunds(w, p) {
  return householdSupporters(w, p).reduce((s, x) => s + x.caracolas, 0);
}
// Cobra `cost` del hogar (primero el propio, luego pareja, luego padres).
function payFood(w, p, cost) {
  const supporters = householdSupporters(w, p);
  if (supporters.reduce((s, x) => s + x.caracolas, 0) < cost - 1e-9) return false;
  let left = cost;
  for (const x of supporters) {
    if (left <= 0) break;
    const take = Math.min(x.caracolas, left);
    x.caracolas -= take; left -= take;
  }
  return true;
}

function logMsg(w, msg) {
  w.log.unshift(`Día ${w.day}: ${msg}`);
  if (w.log.length > 60) w.log.pop();
}

// ---------------------------------------------------------------------------
// Paso de simulación: 1 turno = 1 día
// ---------------------------------------------------------------------------
function step(w) {
  w.day++;
  const living = alive(w);

  // --- 1. Envejecer y muerte por vejez -------------------------------------
  for (const p of living) {
    p.age++;
    if (p.age >= p.lifespan) {
      p.alive = false; p.deathCause = "vejez";
      freeHouseOf(w, p);
      logMsg(w, `${fullName(p)} ha fallecido de vejez a los ${Math.floor(p.age)} días.`);
    }
  }

  // --- 2. Clima / estación: abundancia de pesca ----------------------------
  if (w.drought > 0) {
    w.drought--;
    w.abundance = 0.45;
  } else {
    // ciclo estacional suave + ruido
    const seasonal = 1 + 0.35 * Math.sin((2 * Math.PI * w.day) / CFG.SEASON_PERIOD);
    w.abundance = Math.max(0.4, seasonal * rnd(0.9, 1.1));
    if (Math.random() < CFG.DROUGHT_CHANCE) {
      w.drought = rndInt(4, 9);
      logMsg(w, `☀️ ¡Sequía! La pesca cae durante ${w.drought} días.`);
    }
  }

  const workers = alive(w).filter(p => stage(p) === "adult");

  // --- 3. Asignar constructores vs pescadores ------------------------------
  // Construimos casas si hay solteros adultos sin pareja que superan a las
  // casas libres (demanda de vivienda) y el jugador lo incentiva.
  const freeHouses = w.houses.filter(h => h.ownerId === null).length;
  const singles = workers.filter(p => !p.partnerId);
  const wantHouses = Math.ceil(singles.length / 2);
  const needBuild = wantHouses > freeHouses;
  // al menos 1 constructor cuando hace falta vivienda (si no, con pocos adultos
  // el redondeo daría 0 y la población quedaría topada por las casas)
  const maxBuilders = needBuild
    ? Math.max(1, Math.round(workers.length * w.policy.buildersPct))
    : Math.floor(workers.length * w.policy.buildersPct);

  let buildersActive = workers.filter(p => p.building > 0);
  if (needBuild) {
    for (const p of workers) {
      if (buildersActive.length >= maxBuilders) break;
      if (p.building === 0 && !buildersActive.includes(p)) {
        p.building = 0.0001; buildersActive.push(p);
      }
    }
  }

  // --- 4. Producción de pescado (pescadores) -------------------------------
  let todaysCatch = 0;
  const catchByPerson = new Map();
  for (const p of workers) {
    if (p.building > 0) continue; // está construyendo, no pesca
    const c = CFG.BASE_CATCH * w.abundance * rnd(0.8, 1.2);
    catchByPerson.set(p.id, c);
    todaysCatch += c;
  }
  w.fishStock += todaysCatch;

  // --- 5. Avanzar construcción de viviendas --------------------------------
  for (const p of buildersActive) {
    p.building += 1;
    if (p.building >= CFG.HOUSE_BUILD_DAYS) {
      p.building = 0;
      const h = { id: w.nextHouseId++, ownerId: null, builtDay: w.day,
        x: rnd(0.2, 0.8), y: rnd(0.3, 0.6) };
      w.houses.push(h);
      // el constructor recibe el valor de la vivienda al venderla al mercado
      logMsg(w, `🏠 ${fullName(p)} ha terminado una vivienda nueva.`);
    }
  }

  // --- 6. Política monetaria: el gobierno "imprime" caracolas ---------------
  // Esto AUMENTA la masa monetaria (M). Si no crece el pescado => inflación.
  let printed = 0;
  for (const p of alive(w)) {
    if (w.policy.ubi > 0) { p.caracolas += w.policy.ubi; printed += w.policy.ubi; }
    if (w.policy.pension > 0 && stage(p) === "old") {
      p.caracolas += w.policy.pension; printed += w.policy.pension;
    }
  }
  w.moneyPrinted += printed;

  // --- 7. Fijar precio del pescado (oferta vs demanda + dinero) -------------
  const livingNow = alive(w);
  const demandFish = livingNow.reduce((s, p) => s + need(p), 0);
  const supply = Math.max(1, w.fishStock);
  const M = totalMoney(w);
  // Precio fundamental ≈ M·V / Q  (teoría cuantitativa del dinero)
  const fundamental = (M * CFG.VELOCITY) / supply;
  w.prevPriceFish = w.priceFish;
  w.priceFish += (fundamental - w.priceFish) * CFG.PRICE_ADJUST;
  w.priceFish = Math.max(0.05, w.priceFish);

  // --- 8. Consumo: cada habitante compra su ración ------------------------
  // El dinero fluye de consumidores -> pescadores (se conserva M). Los niños
  // y quien no tenga ingresos son mantenidos por su familia (pareja/padres):
  // por eso los ancianos SIN familia dependen de sus ahorros o de la pensión.
  let fishSold = 0, revenue = 0;
  // ordenar por riqueza del hogar desc para que primero compren los que pueden
  const buyers = [...livingNow].sort((a, b) => householdFunds(w, b) - householdFunds(w, a));
  for (const p of buyers) {
    const want = need(p);
    const stock = Math.floor(w.fishStock);
    const cost = want * w.priceFish;
    if (stock >= want && payFood(w, p, cost)) {
      w.fishStock -= want;
      revenue += cost;
      fishSold += want;
      p.daysHungry = 0;
    } else {
      // intentar comprar al menos algo con los fondos del hogar
      const funds = householdFunds(w, p);
      const affordable = Math.min(want, stock, Math.floor(funds / w.priceFish));
      if (affordable > 0 && payFood(w, p, affordable * w.priceFish)) {
        w.fishStock -= affordable;
        revenue += affordable * w.priceFish;
        fishSold += affordable;
      }
      p.daysHungry++;
      if (p.daysHungry >= CFG.STARVE_DAYS) {
        p.alive = false; p.deathCause = "hambre";
        freeHouseOf(w, p);
        logMsg(w, `💀 ${fullName(p)} ha muerto de hambre.`);
      }
    }
  }

  // Repartir la recaudación entre los pescadores (proporcional a su captura)
  if (todaysCatch > 0 && revenue > 0) {
    for (const [pid, c] of catchByPerson) {
      const p = w.people.find(x => x.id === pid);
      if (p && p.alive) p.caracolas += revenue * (c / todaysCatch);
    }
  }

  // --- 9. Mercado de vivienda: precio por oferta/demanda -------------------
  const freeHousesNow = w.houses.filter(h => h.ownerId === null).length;
  const singlesNow = alive(w).filter(p => stage(p) === "adult" && !p.partnerId).length;
  const housingPressure = (singlesNow / 2) - freeHousesNow; // + => escasez
  const houseFund = CFG.HOUSE_BASE_PRICE * (1 + 0.25 * housingPressure);
  w.priceHouse += (Math.max(20, houseFund) - w.priceHouse) * CFG.HOUSE_ADJUST;

  // --- 10. Formación de familias + compra de vivienda ----------------------
  formFamilies(w);

  // --- 11. Nacimientos ------------------------------------------------------
  births(w);

  // --- 12. Guardar histórico para gráficas ---------------------------------
  const inflation = w.prevPriceFish > 0
    ? ((w.priceFish - w.prevPriceFish) / w.prevPriceFish) * 100 : 0;
  w.history.push({
    day: w.day,
    pop: alive(w).length,
    priceFish: w.priceFish,
    priceHouse: w.priceHouse,
    money: totalMoney(w),
    fishStock: w.fishStock,
    inflation,
  });
  if (w.history.length > 400) w.history.shift();

  return w;
}

// ---------------------------------------------------------------------------
// Helpers de familia / vivienda
// ---------------------------------------------------------------------------
function fullName(p) { return `${p.firstName} ${p.surname}`; }

function freeHouseOf(w, p) {
  if (p.houseId) {
    const h = w.houses.find(h => h.id === p.houseId);
    // la casa solo queda libre si no la ocupa la pareja viva
    const partner = p.partnerId ? w.people.find(x => x.id === p.partnerId) : null;
    if (h && (!partner || !partner.alive)) h.ownerId = null;
    p.houseId = null;
  }
}

function formFamilies(w) {
  const singlesM = alive(w).filter(p => stage(p) === "adult" && !p.partnerId && p.sex === "M");
  const singlesF = alive(w).filter(p => stage(p) === "adult" && !p.partnerId && p.sex === "F");
  const freeHouses = w.houses.filter(h => h.ownerId === null);

  while (singlesM.length && singlesF.length && freeHouses.length) {
    const m = singlesM.pop();
    const f = singlesF.pop();
    const house = freeHouses.pop();
    // Ocupan una vivienda libre. No se destruye dinero: así la masa monetaria
    // (M) solo cambia por la política del gobierno, lo que hace nítida la
    // lección de inflación/deflación. El PRECIO de la vivienda sigue siendo un
    // índice que se mueve por oferta (casas libres) y demanda (solteros).
    m.partnerId = f.id; f.partnerId = m.id;
    house.ownerId = m.id;
    m.houseId = house.id; f.houseId = house.id;
    logMsg(w, `❤️ ${fullName(m)} y ${fullName(f)} forman familia y ocupan una vivienda.`);
  }
}

function births(w) {
  for (const p of alive(w)) {
    if (p.sex !== "F") continue;
    if (!p.partnerId || !p.houseId) continue;
    if (stage(p) !== "adult" || p.age > CFG.FERTILE_MAX_AGE) continue;
    const partner = w.people.find(x => x.id === p.partnerId);
    if (!partner || !partner.alive || stage(partner) !== "adult") continue;
    if (w.day - p.lastBirthDay < CFG.BIRTH_COOLDOWN) continue;
    if (Math.random() < CFG.BIRTH_CHANCE) {
      const dad = partner.sex === "M" ? partner : p;
      const mom = partner.sex === "M" ? p : partner;
      const child = makePerson({
        age: 0,
        parents: [dad.id, mom.id],
        surname: `${dad.surname.split(" ")[0]} ${mom.surname.split(" ")[0]}`,
      });
      dad.childrenIds.push(child.id);
      mom.childrenIds.push(child.id);
      p.lastBirthDay = w.day;
      w.people.push(child);
      logMsg(w, `👶 Nace ${fullName(child)}.`);
    }
  }
}

// Exportar al ámbito global (lo usa app.js)
window.Island = { CFG, newWorld, step, stage, need, fullName, alive, totalMoney };
