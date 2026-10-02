/* ============================================================================
 * Island Simulator — Motor de simulación  (1 turno = 1 año)
 * ----------------------------------------------------------------------------
 * PoC educativo sobre conceptos económicos: inflación / deflación, oferta y
 * demanda, política monetaria y fiscal, banca y recursos naturales.
 *
 * Economía en una frase:
 *   - El PESCADO es el bien real. Los adultos lo pescan; cada familia come
 *     primero lo suyo y vende el excedente en la LONJA (o compra lo que le falta).
 *   - La CARACOLA es el dinero. El PRECIO del pescado sale de la oferta y la
 *     demanda: si las familias quieren comprar más pescado del que se ofrece, sube;
 *     si sobra, baja. Quien tiene ahorros de sobra gasta parte en pescado extra,
 *     así que MÁS DINERO en los bolsillos => MÁS DEMANDA => precios más altos.
 *   - El GOBIERNO cobra un impuesto sobre las ventas de la lonja y lo guarda en
 *     el TESORO. Con él paga la pensión y la renta universal. Si no alcanza, puede
 *     IMPRIMIR dinero (inflación) o recortar las ayudas.
 *   - El BANCO presta para comprar vivienda creando dinero; al devolverse, ese
 *     dinero desaparece. Los intereses van al tesoro.
 *   - El MAR es un recurso finito que se regenera solo. Si se sobrepesca, se
 *     captura menos, las familias ganan menos, la comida sube y nacen menos niños.
 * ==========================================================================*/

// ---------------------------------------------------------------------------
// Parámetros del mundo (ajustables).  Todas las cantidades son POR AÑO.
// ---------------------------------------------------------------------------
const CFG = {
  // Demografía
  LIFESPAN_MIN: 80,
  LIFESPAN_MAX: 110,
  CHILD_MAX_AGE: 10,     // 0-9 => niño
  ADULT_MAX_AGE: 60,     // edad de jubilación por defecto (la cambia el jugador)
  FERTILE_MAX_AGE: 45,   // la mujer del hogar deja de concebir a esta edad
  BIRTH_CHANCE: 0.25,    // prob. anual máx. de tener un hijo (familia próspera)
  BIRTH_COOLDOWN: 3,     // años mínimos entre hijos
  STARVE_YEARS: 3,       // años seguidos sin comer lo suficiente => muerte
  PROSPERITY_YEARS: 4,   // ahorros = 4 años de comida familiar => máxima natalidad

  // Consumo (pescados/año)
  NEED_CHILD: 1,
  NEED_ADULT: 2,
  NEED_OLD: 1,

  // Pesca y mar
  BASE_CATCH: 6,         // captura máxima por pescador/año (con el mar lleno)
  SEA_CAPACITY: 2000,    // peces máximos que puede albergar el mar (recurso finito)
  SEA_REGROWTH: 0.26,    // tasa de regeneración logística del banco de peces
  SEA_MIN_FRAC: 0.03,    // "refugio": el mar nunca baja de este % (puede recuperarse)
  CATCH_FLOOR: 0.20,     // captura mínima relativa aunque el mar esté agotado
  SPOIL_RATE: 0.04,      // % del pescado de la lonja que se estropea cada año

  // Mercado del pescado
  PRICE_MAX_STEP: 0.12,  // el precio cambia como mucho un ±12% al año
  RESERVE_YEARS: 3,      // ahorro que una familia quiere tener antes de gastar en caprichos
  LEND_RESERVE_YEARS: 1, // ahorro mínimo (en años de comida) que no se presta ni se usa para pagar la hipoteca
  SPEND_RICH: 0.10,      // fracción del ahorro SOBRANTE que se gasta al año en pescado extra

  // Inmigración: ahorro que trae cada recién llegado (en pescados)
  IMMIGRANT_SAVINGS_FISH: 5,

  // Tesoro: reserva que guarda (en pescados por habitante) antes de repartir superávit
  TREASURY_RESERVE_FISH: 3,
  SURPLUS_SHARE_RATE: 0.5, // fracción del superávit que se reparte cada año

  // Vivienda y banco
  HOUSE_BUILD_YEARS: 5,  // años de trabajo de 1 adulto para una casa
  HOUSE_BASE_FISH: 30,   // valor de referencia de una casa, en pescados
  HOUSE_ADJUST: 0.15,
  LOAN_TERM: 25,         // años para amortizar una hipoteca
  LOAN_INCOME_SHARE: 0.7,// parte del excedente de la pareja que el banco acepta como cuota

  // Natalidad: bonus si las mujeres NO trabajan (dedican más tiempo a criar)
  NONWORK_BIRTH_BONUS: 1.8,
  // y menos hijos si la pareja no tiene vivienda propia (vive con sus padres)
  NOHOUSE_BIRTH_FACTOR: 0.4,
  // si la mujer no trabaja fuera, marisquea/cultiva para su casa: produce esta
  // fracción de lo que saca un pescador
  HOME_PRODUCTION: 0.4,

  // Arranque
  START_CARACOLAS: 50,   // caracolas iniciales por adulto
  START_FISH_STOCK: 120, // stock inicial en la lonja (colchón para sequías)
  START_PRICE: 2.0,
  START_TREASURY: 150,   // reserva inicial del tesoro

  // Clima
  SEASON_PERIOD: 40,     // años por ciclo de abundancia <-> escasez
  DROUGHT_CHANCE: 0.015, // prob. anual de sequía
};

// Nombres y apellidos españoles para dar vida al árbol genealógico
const NAMES_M = ["Mateo","Hugo","Martín","Lucas","Leo","Daniel","Álvaro","Pablo","Marcos","Diego","Bruno","Gael","Nicolás","Adrián","Enzo","Mario","Thiago","Izan","Liam","Dylan"];
const NAMES_F = ["Lucía","Sofía","Martina","María","Julia","Paula","Emma","Daniela","Valeria","Alba","Carla","Noa","Vega","Olivia","Chloe","Sara","Candela","Jimena","Ana","Lola"];
const SURNAMES = ["García","Fernández","Rodríguez","López","Martínez","Sánchez","Pérez","Gómez","Marín","Torres","Ramos","Vargas","Castro","Rubio","Serrano","Molina","Ortega","Delgado","Navarro","Mar"];

let _idSeq = 1;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------------------------------------------------------------------------
// Habitante
// ---------------------------------------------------------------------------
function makePerson({ age = 0, sex, firstName, surname, parents = null }) {
  sex = sex || (Math.random() < 0.5 ? "M" : "F");
  return {
    id: _idSeq++,
    firstName: firstName || (sex === "M" ? pick(NAMES_M) : pick(NAMES_F)),
    surname: surname || `${pick(SURNAMES)} ${pick(SURNAMES)}`,
    sex,
    age,                       // en años
    lifespan: rndInt(CFG.LIFESPAN_MIN, CFG.LIFESPAN_MAX),
    householdId: null,         // el dinero es del HOGAR, no de la persona
    alive: true,
    deathCause: null,
    hungryYears: 0,            // años seguidos sin comer lo suficiente
    partnerId: null,
    parents,                   // [idPadre, idMadre] o null (fundador)
    childrenIds: [],
    houseId: null,
    building: 0,               // progreso de construcción (0..HOUSE_BUILD_YEARS)
    lastBirthDay: -9999,       // año del último parto
  };
}

// ---------------------------------------------------------------------------
// Hogares (economía familiar): la bolsa común de la que vive toda la casa
// ---------------------------------------------------------------------------
function hhOf(w, p) { return p.householdId ? w.households.find(h => h.id === p.householdId) : null; }
function walletOf(w, p) { const h = hhOf(w, p); return h ? h.wallet : 0; }
function addToHousehold(hh, p) {
  if (!hh.memberIds.includes(p.id)) hh.memberIds.push(p.id);
  p.householdId = hh.id;
}
function makeHousehold(w, { houseId = null, wallet = 0, fatherId = null, motherId = null, members = [] }) {
  // wallet = dinero en mano; deposit = ahorro prestado al banco (cobra intereses);
  // debt = hipoteca pendiente
  const hh = { id: w.nextHouseholdId++, wallet, houseId, fatherId, motherId, memberIds: [], debt: 0, deposit: 0 };
  w.households.push(hh);
  for (const m of members) addToHousehold(hh, m);
  return hh;
}
function livingMembers(w, hh) {
  return hh.memberIds.map(id => w.people.find(x => x.id === id)).filter(x => x && x.alive);
}
function familyNeed(w, hh) { return livingMembers(w, hh).reduce((s, m) => s + need(m), 0); }
// Hogares de los hijos (de la pareja fundadora) que ya viven por su cuenta
function childHouseholds(w, hh) {
  const ids = new Set();
  for (const fid of [hh.fatherId, hh.motherId]) {
    const founder = fid ? w.people.find(x => x.id === fid) : null;
    if (!founder) continue;
    for (const cid of founder.childrenIds) {
      const c = w.people.find(x => x.id === cid);
      if (c && c.alive && c.householdId && c.householdId !== hh.id) ids.add(c.householdId);
    }
  }
  return [...ids].map(id => w.households.find(h => h.id === id)).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Banco: intermediario del ahorro. Presta los ahorros sobrantes de las familias
// (que pasan a ser DEPÓSITOS) a las parejas que compran casa. Los intereses y
// las cuotas de los hipotecados vuelven a los ahorradores. No crea dinero.
// ---------------------------------------------------------------------------
function spareOf(w, hh, price) {
  return Math.max(0, hh.wallet - CFG.LEND_RESERVE_YEARS * familyNeed(w, hh) * price);
}
function totalDeposits(w) {
  return w.households.reduce((s, h) => s + (h.deposit || 0), 0) + (w.treasuryDeposit || 0);
}
// Reúne `amount` caracolas del ahorro sobrante de las familias (proporcional).
function fundLoan(w, amount, price) {
  const lenders = w.households.map(h => ({ h, s: spareOf(w, h, price) })).filter(x => x.s > 0);
  const total = lenders.reduce((a, x) => a + x.s, 0);
  if (total < amount) return false;
  for (const x of lenders) {
    const take = amount * x.s / total;
    x.h.wallet -= take; x.h.deposit = (x.h.deposit || 0) + take;
  }
  return true;
}
// Reparte intereses y devolución de principal entre los ahorradores.
function payDepositors(w, interest, principal) {
  const tot = totalDeposits(w);
  if (tot <= 1e-9) { w.treasury += interest + principal; return; }
  for (const h of w.households) {
    const d = h.deposit || 0;
    if (d <= 0) continue;
    const sh = d / tot;
    h.wallet += (interest + principal) * sh;
    h.deposit = Math.max(0, d - principal * sh);
  }
  if (w.treasuryDeposit > 0) {
    const sh = w.treasuryDeposit / tot;
    w.treasury += (interest + principal) * sh;
    w.treasuryDeposit = Math.max(0, w.treasuryDeposit - principal * sh);
  }
}
// Un préstamo que no se va a cobrar: los ahorradores pierden esa parte.
function writeOff(w, loss) {
  const tot = totalDeposits(w);
  if (tot <= 1e-9 || loss <= 0) return;
  const f = Math.max(0, 1 - loss / tot);
  for (const h of w.households) if (h.deposit) h.deposit *= f;
  w.treasuryDeposit *= f;
  w.bankLosses += loss;
}

// Edad de jubilación en vigor (la fija el jugador). A partir de ella se es
// "viejo": no se produce y se puede cobrar pensión.
let _retireAge = CFG.ADULT_MAX_AGE;
function setRetireAge(a) { _retireAge = a; }

function stage(p) {
  if (p.age < CFG.CHILD_MAX_AGE) return "child";
  if (p.age < _retireAge) return "adult";
  return "old";
}
function need(p) {
  const s = stage(p);
  return s === "adult" ? CFG.NEED_ADULT : (s === "old" ? CFG.NEED_OLD : CFG.NEED_CHILD);
}
// a quién alimenta antes la familia cuando no hay para todos: niños, luego
// adultos (producen), y por último los viejos
function feedPriority(p) {
  const s = stage(p);
  return s === "child" ? 0 : (s === "adult" ? 1 : 2);
}

// ---------------------------------------------------------------------------
// Estado del mundo
// ---------------------------------------------------------------------------
function newWorld(setup) {
  _idSeq = 1;
  const cfg = Object.assign({ children: 4, adults: 10, olds: 2 }, setup || {});
  const nAdults = Math.max(0, Math.floor(cfg.adults));
  const nChildren = Math.max(0, Math.floor(cfg.children));
  const nOlds = Math.max(0, Math.floor(cfg.olds));

  const w = {
    day: 0,                               // año actual (1 turno = 1 año)
    people: [],
    houses: [],
    households: [],                       // economías familiares (bolsa común)
    nextHouseId: 1,
    nextHouseholdId: 1,
    fishStock: CFG.START_FISH_STOCK,     // lonja: pescado a la venta / almacenado
    seaFish: CFG.SEA_CAPACITY,           // banco de peces del mar
    priceFish: CFG.START_PRICE,
    prevPriceFish: CFG.START_PRICE,
    priceHouse: CFG.HOUSE_BASE_FISH * CFG.START_PRICE,
    abundance: 1.0,
    drought: 0,
    lastCatch: 0,
    builders: 0,
    fishWage: 0, buildWage: 0,
    marketD: 0, marketS: 0,              // demanda y oferta de pescado del último año
    policy: {
      pension: 1, ubi: 0, tax: 15, allowPrint: false, quota: 8, shareSurplus: true,
      buildersPct: 0.6, interest: 3, retireAge: CFG.ADULT_MAX_AGE, womenWork: true,
    },
    treasury: CFG.START_TREASURY, // tesoro público (impuestos, ventas de casas públicas, herencias vacantes)
    treasuryDeposit: 0,   // ahorro del tesoro prestado al banco (de herencias vacantes)
    moneyPrinted: 0,      // dinero impreso en total
    heirlessToTreasury: 0,// herencias sin heredero que pasaron al tesoro
    bankInterest: 0,      // intereses pagados por los hipotecados a los ahorradores
    bankRepaid: 0,        // principal devuelto a los ahorradores
    bankLosses: 0,        // préstamos impagados (pérdida de los ahorradores)
    immigrants: 0,        // personas llegadas de fuera
    mortgagesGranted: 0,  // hipotecas concedidas
    mortgagesDenied: 0,   // hipotecas denegadas (no pueden pagarla o no hay ahorro)
    welfareCut: 0,        // % de ayudas recortadas por falta de tesoro
    hungerLog: [],        // muertes por hambre de cada año (últimos 10)
    flows: { taxes: 0, houseSales: 0, estates: 0, welfare: 0, dividend: 0, works: 0, printed: 0, interest: 0, bankRepaid: 0, loans: 0, immigration: 0 },
    stats: {},
    log: [],
    history: [],
  };

  const addHouse = () => {
    const h = { id: w.nextHouseId++, ownerId: null, builderId: null, builtDay: 0 };
    w.houses.push(h); return h;
  };

  // Crea `n` personas (alternando sexo) y las devuelve emparejadas de dos en dos
  function makeCouples(n, ageMin, ageMax) {
    const g = [];
    for (let i = 0; i < n; i++) {
      const p = makePerson({ age: rndInt(ageMin, ageMax), sex: i % 2 === 0 ? "M" : "F" });
      w.people.push(p); g.push(p);
    }
    const couples = [], singles = [];
    for (let i = 0; i + 1 < g.length; i += 2) {
      g[i].partnerId = g[i + 1].id; g[i + 1].partnerId = g[i].id;
      couples.push({ m: g[i], f: g[i + 1] });
    }
    if (g.length % 2 === 1) singles.push(g[g.length - 1]);
    return { couples, singles };
  }

  // edades variadas para que la cohorte NO envejezca toda a la vez
  const adultRes = makeCouples(nAdults, 20, 54);
  const oldRes = makeCouples(nOlds, 61, 75);

  const adultHouseholds = [];
  const seedCouple = (m, f) => {
    const house = addHouse(); house.ownerId = m.id;
    m.houseId = house.id; f.houseId = house.id;
    return makeHousehold(w, { houseId: house.id, wallet: CFG.START_CARACOLAS * 2,
      fatherId: m.id, motherId: f.id, members: [m, f] });
  };
  for (const { m, f } of adultRes.couples) adultHouseholds.push(seedCouple(m, f));
  for (const { m, f } of oldRes.couples) seedCouple(m, f);

  for (const s of [...adultRes.singles, ...oldRes.singles]) {
    const house = addHouse(); house.ownerId = s.id; s.houseId = house.id;
    makeHousehold(w, { houseId: house.id, wallet: CFG.START_CARACOLAS,
      fatherId: s.sex === "M" ? s.id : null, motherId: s.sex === "F" ? s.id : null, members: [s] });
  }

  for (let i = 0; i < nChildren; i++) {
    const hh = adultHouseholds.length ? adultHouseholds[i % adultHouseholds.length] : null;
    const dad = hh ? w.people.find(x => x.id === hh.fatherId) : null;
    const mom = hh ? w.people.find(x => x.id === hh.motherId) : null;
    const surname = dad && mom
      ? `${dad.surname.split(" ")[0]} ${mom.surname.split(" ")[0]}` : undefined;
    const child = makePerson({ age: rndInt(1, 9),
      parents: dad && mom ? [dad.id, mom.id] : null, surname });
    child.lastBirthDay = 0;
    w.people.push(child);
    if (dad) dad.childrenIds.push(child.id);
    if (mom) mom.childrenIds.push(child.id);
    if (hh) addToHousehold(hh, child);
    else makeHousehold(w, { members: [child], wallet: 0 });
  }

  // Holgura de viviendas libres para que la población pueda crecer
  const spare = Math.max(4, Math.round(nAdults * 0.8) + nOlds);
  for (let i = 0; i < spare; i++) addHouse();

  // Condiciones iniciales de un escenario (política de partida, mar, tesoro)
  if (cfg.policy) Object.assign(w.policy, cfg.policy);
  if (cfg.seaFrac != null) w.seaFish = CFG.SEA_CAPACITY * cfg.seaFrac;
  if (cfg.treasury != null) w.treasury = cfg.treasury;
  if (cfg.stableClimate) w.stableClimate = true;

  computeStats(w, { hungerDeaths: 0, hungry: 0, taxes: 0, printed: 0, fromTreasury: 0 });
  return w;
}

function alive(w) { return w.people.filter(p => p.alive); }
// La masa monetaria EN CIRCULACIÓN es lo que tienen las familias (el tesoro no
// compra pescado, así que no presiona los precios hasta que se gasta).
function totalMoney(w) { return w.households.reduce((s, h) => s + h.wallet, 0); }

function logMsg(w, msg) {
  w.log.unshift(`Año ${w.day}: ${msg}`);
  if (w.log.length > 60) w.log.pop();
}

// ---------------------------------------------------------------------------
// Paso de simulación: 1 turno = 1 año
// ---------------------------------------------------------------------------
function step(w) {
  w.day++;
  setRetireAge(w.policy.retireAge);
  const T = { hungerDeaths: 0, hungry: 0, taxes: 0, printed: 0, fromTreasury: 0 };
  // cuentas del tesoro de este año (entradas y salidas), para mostrarlas
  w.flows = { taxes: 0, houseSales: 0, estates: 0, welfare: 0, dividend: 0, works: 0, printed: 0, interest: 0, bankRepaid: 0, loans: 0, immigration: 0 };

  // --- 1. Envejecer y muerte por vejez -------------------------------------
  for (const p of alive(w)) {
    p.age++;
    if (p.age >= p.lifespan) {
      logMsg(w, `${fullName(p)} ha fallecido de vejez a los ${Math.floor(p.age)} años.` + die(w, p, "vejez"));
    }
  }

  // --- 2. Clima: abundancia de pesca ---------------------------------------
  if (w.stableClimate) {
    // escenarios guiados: sin estaciones ni sequías, para ver solo el efecto
    // de las medidas del jugador
    w.abundance = 1;
  } else if (w.drought > 0) {
    w.drought--;
    w.abundance = 0.6;
  } else {
    const seasonal = 1 + 0.35 * Math.sin((2 * Math.PI * w.day) / CFG.SEASON_PERIOD);
    w.abundance = Math.max(0.4, seasonal * rnd(0.9, 1.1));
    if (Math.random() < CFG.DROUGHT_CHANCE) {
      w.drought = rndInt(4, 9);
      logMsg(w, `☀️ ¡Sequía! La pesca cae durante ${w.drought} años.`);
    }
  }

  // Trabajadores: todos los adultos, o solo los hombres si las mujeres no trabajan
  const workers = alive(w).filter(p => stage(p) === "adult" && (w.policy.womenWork || p.sex === "M"));

  // --- 3. Reparto del trabajo: pescar o construir --------------------------
  const seaRatio = w.seaFish / CFG.SEA_CAPACITY;
  // captura esperada por pescador: depende de la DENSIDAD del mar (sobrepesca↓)
  const expCatch = CFG.BASE_CATCH * w.abundance *
    (CFG.CATCH_FLOOR + (1 - CFG.CATCH_FLOOR) * seaRatio);
  w.expCatch = expCatch;
  w.fishWage = expCatch * w.priceFish;                     // caracolas/año pescando
  w.buildWage = w.priceHouse / CFG.HOUSE_BUILD_YEARS;      // caracolas/año construyendo

  const freeHouses = w.houses.filter(h => h.ownerId === null).length;
  const singles = workers.filter(p => !p.partnerId);
  const wantHouses = Math.ceil(singles.length / 2) + 3;    // parejas por formar + colchón
  const buildersActive = workers.filter(p => p.building > 0);
  const buildingCount = buildersActive.length;
  const housingDeficit = wantHouses - freeHouses - buildingCount;
  // comer antes que construir: se reservan pescadores para cubrir la demanda
  const demandToday = alive(w).reduce((s, p) => s + need(p), 0);
  const minFishers = expCatch > 0.01 ? Math.ceil(demandToday / expCatch) : workers.length;
  let desiredBuilders = buildingCount + Math.max(0, housingDeficit);
  const maxBuilders = Math.max(0, Math.min(
    Math.round(workers.length * w.policy.buildersPct), workers.length - minFishers));
  desiredBuilders = Math.min(desiredBuilders, maxBuilders);
  // La vivienda es OBRA PÚBLICA: el tesoro paga el jornal de los constructores.
  // Si no se permite imprimir, solo se contrata a quien el tesoro puede pagar.
  if (!w.policy.allowPrint) {
    desiredBuilders = Math.min(desiredBuilders, Math.floor(w.treasury / Math.max(0.01, w.buildWage)));
  }
  for (const p of workers) {
    if (buildersActive.length >= desiredBuilders) break;
    if (p.building === 0 && !buildersActive.includes(p)) { p.building = 0.0001; buildersActive.push(p); }
  }
  w.builders = buildersActive.length;

  // --- 4. Pesca -------------------------------------------------------------
  // Cada familia pesca PRIMERO lo que necesita para comer y, además, su parte de
  // lo que el mercado se llevó el año pasado. Si la lonja rebosa y el pescado no
  // se vende, no compensa salir a pescar de más (no se esquilma el mar para
  // tirar pescado podrido).
  // productores: pescadores (capacidad completa) y, si las mujeres no trabajan
  // fuera, ellas marisquean para su casa (capacidad reducida)
  const producers = workers.filter(p => p.building === 0).map(p => ({ p, cap: expCatch }));
  if (!w.policy.womenWork) {
    for (const p of alive(w)) {
      if (stage(p) === "adult" && p.sex === "F") producers.push({ p, cap: expCatch * CFG.HOME_PRODUCTION });
    }
  }
  const prodByHH = new Map();
  for (const x of producers) {
    if (!prodByHH.has(x.p.householdId)) prodByHH.set(x.p.householdId, []);
    prodByHH.get(x.p.householdId).push(x);
  }
  const totalCapacity = producers.reduce((s, x) => s + x.cap, 0);
  // Se pesca para lo que la gente NECESITA comprar (no solo para lo que pudo
  // pagar el año pasado): si el precio sube, se pesca más, no menos.
  const marketWanted = Math.max(0, (w.marketNeed != null ? w.marketNeed : w.marketD) * 1.05 - w.fishStock);
  let todaysCatch = 0, targetSum = 0;
  const catchByPerson = new Map();
  for (const [hid, list] of prodByHH) {
    const hh = w.households.find(h => h.id === hid);
    const capacity = list.reduce((s, x) => s + x.cap, 0);
    const ownNeed = hh ? familyNeed(w, hh) : 0;
    const share = totalCapacity > 0 ? marketWanted * capacity / totalCapacity : 0;
    const target = Math.min(capacity, ownNeed + share);
    targetSum += target;
    for (const x of list) {
      const c = target * (x.cap / capacity) * rnd(0.9, 1.1);
      catchByPerson.set(x.p.id, c);
      todaysCatch += c;
    }
  }
  const effort = totalCapacity > 0 ? targetSum / totalCapacity : 1;
  // CUOTA DE PESCA (medida del gobierno): como mucho un % del banco de peces al
  // año. Y nunca por debajo del "refugio", para que el mar pueda recuperarse.
  const refuge = CFG.SEA_CAPACITY * CFG.SEA_MIN_FRAC;
  const quotaCap = w.seaFish * w.policy.quota / 100;
  const catchable = Math.max(0, Math.min(quotaCap, w.seaFish - refuge));
  w.quotaHit = todaysCatch > catchable;
  if (todaysCatch > catchable && todaysCatch > 0) {
    const scale = catchable / todaysCatch;
    for (const [pid, c] of catchByPerson) catchByPerson.set(pid, c * scale);
    todaysCatch = catchable;
  }
  w.effort = effort;
  // margen de comida: cuánto más se PODRÍA pescar (por brazos y por cuota) que lo
  // que se necesita. Si se acerca a 1, la isla está en su límite y las familias,
  // al ver que escasea, tienen menos hijos.
  w.foodRoom = demandToday > 0 ? Math.min(totalCapacity, catchable) / demandToday : 2;
  w.fishStock *= (1 - CFG.SPOIL_RATE);   // el pescado almacenado se estropea
  w.seaFish -= todaysCatch;
  w.lastCatch = todaysCatch;
  // regeneración logística del mar (recurso renovable pero finito)
  w.seaFish += CFG.SEA_REGROWTH * w.seaFish * (1 - w.seaFish / CFG.SEA_CAPACITY);
  w.seaFish = Math.min(CFG.SEA_CAPACITY, Math.max(refuge, w.seaFish));

  // --- 5. Construcción de viviendas (obra pública) --------------------------
  // El tesoro paga cada año el jornal del constructor (si no llega, imprime si
  // está permitido; si no, la obra se para). La casa terminada es del tesoro,
  // que la venderá a una pareja joven.
  for (const p of buildersActive) {
    const wage = w.buildWage;
    let paid = Math.min(w.treasury, wage);
    w.treasury -= paid;
    if (paid < wage - 1e-9 && w.policy.allowPrint) {
      const pr = wage - paid;
      w.moneyPrinted += pr; w.flows.printed += pr; paid = wage;
    }
    const hh = hhOf(w, p);
    if (hh) hh.wallet += paid;
    w.flows.works += paid;
    if (paid < wage - 1e-9) {           // sin fondos: la obra se para
      p.building = 0;
      continue;
    }
    p.building += 1;
    if (p.building >= CFG.HOUSE_BUILD_YEARS + 0.0001) {
      p.building = 0;
      w.houses.push({ id: w.nextHouseId++, ownerId: null, builderId: null, builtDay: w.day });
      logMsg(w, `🏠 ${fullName(p)} ha terminado una vivienda pública nueva.`);
    }
  }

  // --- 6. Gasto público: pensión + renta universal ------------------------
  // Se pagan con el TESORO (impuestos). Si no alcanza: se imprime dinero (si el
  // jugador lo permite → inflación) o se RECORTAN las ayudas.
  {
    const living = alive(w);
    const nOld = living.filter(p => stage(p) === "old").length;
    const cost = w.policy.ubi * living.length + w.policy.pension * nOld;
    let paidRatio = 1;
    if (cost > 0) {
      const fromT = Math.min(w.treasury, cost);
      w.treasury -= fromT; T.fromTreasury = fromT; w.flows.welfare += fromT;
      const missing = cost - fromT;
      if (missing > 0 && w.policy.allowPrint) { T.printed = missing; w.moneyPrinted += missing; w.flows.printed += missing; }
      else if (missing > 0) paidRatio = fromT / cost;
      for (const p of living) {
        const hh = hhOf(w, p);
        if (!hh) continue;
        hh.wallet += (w.policy.ubi + (stage(p) === "old" ? w.policy.pension : 0)) * paidRatio;
      }
    }
    w.welfareCut = cost > 0 ? (1 - paidRatio) * 100 : 0;
    // Reparto del superávit: si el tesoro tiene más de lo que necesita de reserva,
    // devuelve parte a los habitantes (a partes iguales). Si no se reparte, el
    // dinero se queda parado en el tesoro: menos dinero en la calle → deflación.
    if (w.policy.shareSurplus && living.length) {
      const reserve = CFG.TREASURY_RESERVE_FISH * living.length * w.priceFish;
      if (w.treasury > reserve) {
        const dist = (w.treasury - reserve) * CFG.SURPLUS_SHARE_RATE;
        w.treasury -= dist; w.flows.dividend += dist;
        for (const p of living) { const hh = hhOf(w, p); if (hh) hh.wallet += dist / living.length; }
      }
    }
  }

  // --- 7. Mercado del pescado: autoabastecimiento + oferta y demanda --------
  const pPrev = w.priceFish;
  const reserveOf = hh => CFG.RESERVE_YEARS * hh._need * pPrev;
  // 7.1 cada familia come primero de lo que pescan sus adultos
  for (const hh of w.households) { hh._catch = 0; hh._need = familyNeed(w, hh); }
  for (const [pid, c] of catchByPerson) {
    const p = w.people.find(x => x.id === pid);
    if (p && p.alive) { const hh = hhOf(w, p); if (hh) hh._catch += c; }
  }
  let totalSurplus = 0;
  for (const hh of w.households) {
    hh._own = Math.min(hh._catch, hh._need);   // lo que comen de su propia pesca
    hh._surplus = hh._catch - hh._own;         // lo que les sobra → a la venta
    hh._deficit = hh._need - hh._own;          // lo que les falta → a comprar
    hh._eaten = hh._own;
    totalSurplus += hh._surplus;
  }
  // 7.2 los hijos ayudan a sus padres mayores si no les llega para comer
  for (const hh of w.households) {
    const hasOld = livingMembers(w, hh).some(m => stage(m) === "old");
    const short = hh._deficit * pPrev - hh.wallet;
    if (!hasOld || short <= 0) continue;
    let left = short;
    for (const kid of childHouseholds(w, hh)) {
      const spare = Math.max(0, kid.wallet - reserveOf(kid));
      const give = Math.min(spare, left);
      if (give > 0) { kid.wallet -= give; hh.wallet += give; left -= give; }
      if (left <= 0) break;
    }
  }
  // 7.3 OFERTA (excedente de hoy + lo que queda en la lonja) y DEMANDA (lo que
  //     falta a las familias + consumo extra de quien tiene ahorros de sobra)
  w.fishStock += totalSurplus;
  const S = w.fishStock;
  let D = 0, needQ = 0;
  for (const hh of w.households) {
    const spare = Math.max(0, hh.wallet - reserveOf(hh));
    hh._extra = spare * CFG.SPEND_RICH / pPrev;
    D += Math.min(hh._deficit + hh._extra, hh.wallet / pPrev);
    needQ += hh._deficit + hh._extra;
  }
  w.marketNeed = needQ;
  // 7.4 el precio sube si se quiere comprar más de lo que hay, y baja si sobra
  const ratio = S > 0.01 ? D / S : (D > 0 ? 4 : 1);
  const factor = clamp(Math.pow(ratio, 0.4), 1 - CFG.PRICE_MAX_STEP, 1 + CFG.PRICE_MAX_STEP);
  w.prevPriceFish = pPrev;
  w.priceFish = Math.max(0.05, pPrev * factor);
  w.marketD = D; w.marketS = S;
  const price = w.priceFish;
  // 7.5 compras: primero la comida necesaria, después el consumo extra (los que
  //     más tienen compran antes: si hay escasez, la sufren los más pobres)
  let fund = 0;
  const byWealth = [...w.households].sort((a, b) => b.wallet - a.wallet);
  for (const hh of byWealth) {
    const buy = Math.max(0, Math.min(hh._deficit, w.fishStock, hh.wallet / price));
    if (buy > 0) { hh.wallet -= buy * price; w.fishStock -= buy; fund += buy * price; hh._eaten += buy; }
  }
  for (const hh of byWealth) {
    const buy = Math.max(0, Math.min(hh._extra, w.fishStock, hh.wallet / price));
    if (buy > 0) { hh.wallet -= buy * price; w.fishStock -= buy; fund += buy * price; }
  }
  // 7.6 impuesto sobre las ventas → tesoro; el resto, a los vendedores
  const tax = fund * w.policy.tax / 100;
  w.treasury += tax; T.taxes = tax; w.flows.taxes += tax;
  const net = fund - tax;
  const totalCatchHH = w.households.reduce((s, h) => s + h._catch, 0);
  if (totalSurplus > 0) {
    for (const hh of w.households) if (hh._surplus > 0) hh.wallet += net * (hh._surplus / totalSurplus);
  } else if (totalCatchHH > 0) {
    // hoy nadie tenía excedente (se vendió pescado guardado): cobran los pescadores
    for (const hh of w.households) if (hh._catch > 0) hh.wallet += net * (hh._catch / totalCatchHH);
  } else {
    w.treasury += net; w.flows.taxes += net;
  }
  // 7.7 reparto de la comida dentro de cada hogar y hambre
  for (const hh of [...w.households]) {
    let pool = hh._eaten;
    // por prioridad (niños, adultos, viejos); a igual prioridad, sin favoritismos
    const members = livingMembers(w, hh)
      .map(m => ({ m, k: feedPriority(m) + Math.random() * 0.5 }))
      .sort((a, b) => a.k - b.k).map(x => x.m);
    for (const m of members) {
      const nd = need(m);
      if (pool >= nd - 1e-9) { pool -= nd; m.hungryYears = 0; }
      else {
        pool = 0; m.hungryYears++; T.hungry++;
        if (m.hungryYears >= CFG.STARVE_YEARS) {
          T.hungerDeaths++;
          logMsg(w, `💀 ${fullName(m)} ha muerto de hambre.` + die(w, m, "hambre"));
        }
      }
    }
  }

  // --- 8. Banco: cobro de hipotecas -----------------------------------------
  // Interés anual (lo fija el jugador) + 1/LOAN_TERM del principal. Lo cobran
  // los AHORRADORES que prestaron ese dinero. Las familias hipotecadas guardan
  // antes su reserva para comer (si no les llega, pagan menos ese año).
  let paidI = 0, paidP = 0;
  for (const hh of w.households) {
    if (hh.debt <= 0.01) continue;
    let avail = Math.max(0, hh.wallet - CFG.LEND_RESERVE_YEARS * familyNeed(w, hh) * price);
    if (avail <= 0) continue;
    const iPart = Math.min(avail, hh.debt * w.policy.interest / 100);
    hh.wallet -= iPart; avail -= iPart; paidI += iPart;
    const principal = Math.min(avail, hh.debt / CFG.LOAN_TERM, hh.debt);
    hh.wallet -= principal; hh.debt -= principal; paidP += principal;
  }
  payDepositors(w, paidI, paidP);
  w.bankInterest += paidI; w.bankRepaid += paidP;
  w.flows.interest += paidI; w.flows.bankRepaid += paidP;

  // --- 9. Precio de la vivienda: valor real (en pescados) × escasez ---------
  // Se mide en pescados (sube con la inflación) y la escasez lo mueve ±30%.
  const freeHousesNow = w.houses.filter(h => h.ownerId === null).length;
  const singlesNow = alive(w).filter(p => stage(p) === "adult" && !p.partnerId).length;
  const housingPressure = clamp(((singlesNow / 2) - freeHousesNow) / 5, -1, 1); // + => escasez
  const houseTarget = CFG.HOUSE_BASE_FISH * price * (1 + 0.3 * housingPressure);
  w.priceHouse += (houseTarget - w.priceHouse) * CFG.HOUSE_ADJUST;

  // --- 10. Bodas y vivienda -------------------------------------------------
  formFamilies(w);

  // --- 11. Nacimientos e inmigración ----------------------------------------
  births(w);
  immigration(w);

  // --- 12. Indicadores y histórico -----------------------------------------
  computeStats(w, T);
  const s = w.stats;
  w.history.push({
    day: w.day,
    pop: alive(w).length,
    priceFish: w.priceFish,
    money: totalMoney(w),
    treasury: w.treasury,
    fishStock: w.fishStock,
    seaFish: w.seaFish,
    prodPerCap: s.prodPerCap,
    wealthPerCap: s.wealthPerCap,
    poverty: s.povertyRate,
    hunger10: s.hungerDeaths10,
    births10: s.births10,
    welfareCut: w.welfareCut,
    ubiReal: w.policy.ubi / w.priceFish,
    pensionReal: w.policy.pension / w.priceFish,
    noHouse: w.households.filter(h => !h.houseId && h.fatherId && h.motherId).length,
    olds: alive(w).filter(p => stage(p) === "old").length,
    workers: alive(w).filter(p => stage(p) === "adult").length,
  });
  if (w.history.length > 400) w.history.shift();
  return w;
}

// ---------------------------------------------------------------------------
// Indicadores de bienestar y poder adquisitivo (medidos en PESCADOS: reales,
// sin el efecto de la inflación)
// ---------------------------------------------------------------------------
function gini(values) {
  const n = values.length;
  if (n < 2) return 0;
  const v = [...values].sort((a, b) => a - b);
  const sum = v.reduce((a, b) => a + b, 0);
  if (sum <= 0) return 0;
  let acc = 0;
  for (let i = 0; i < n; i++) acc += (i + 1) * v[i];
  return (2 * acc) / (n * sum) - (n + 1) / n;
}

function computeStats(w, T) {
  const living = alive(w);
  const pop = Math.max(1, living.length);
  const price = w.priceFish;
  // riqueza de cada habitante = su parte del dinero + ahorro en el banco − deuda
  // de su familia, medida en PESCADOS (riqueza real, sin el efecto de la inflación)
  const wealthFish = living.map(p => {
    const hh = hhOf(w, p);
    if (!hh) return 0;
    const net = hh.wallet + (hh.deposit || 0) - (hh.debt || 0);
    return (net / Math.max(1, livingMembers(w, hh).length)) / price;
  });
  // pobreza: vive en un hogar que no se alimenta solo y cuyos ahorros no cubren
  // 3 años de lo que le falta (o que ya ha pasado hambre este año)
  let poor = 0;
  for (const hh of w.households) {
    const mem = livingMembers(w, hh);
    if (!mem.length) continue;
    const def = hh._deficit || 0;
    const hungry = mem.some(m => m.hungryYears > 0);
    if (hungry || (def > 0.01 && hh.wallet < CFG.RESERVE_YEARS * def * price)) poor += mem.length;
  }
  w.hungerLog.push(T.hungerDeaths);
  if (w.hungerLog.length > 10) w.hungerLog.shift();
  w.birthLog = w.birthLog || [];
  w.birthLog.push(w.birthsYear || 0); w.birthsYear = 0;
  if (w.birthLog.length > 10) w.birthLog.shift();
  const back = w.history.length >= 10 ? w.history[w.history.length - 10].priceFish : null;
  w.stats = {
    prodPerCap: w.lastCatch / pop,                                   // 🐟/hab producidos este año
    wealthPerCap: wealthFish.reduce((a, b) => a + b, 0) / pop,       // 🐟/hab de ahorro
    gini: gini(wealthFish.map(v => Math.max(0, v))),
    povertyRate: (poor / pop) * 100,
    hungerDeaths10: w.hungerLog.reduce((a, b) => a + b, 0),
    births10: w.birthLog.reduce((a, b) => a + b, 0),
    inflation10: back ? ((price / back) - 1) * 100 : 0,
    taxes: T.taxes, printed: T.printed, fromTreasury: T.fromTreasury,
  };
}

// ---------------------------------------------------------------------------
// Familia, herencia y vivienda
// ---------------------------------------------------------------------------
function fullName(p) { return `${p.firstName} ${p.surname}`; }

// Una muerte. Como el dinero es del HOGAR, el resto de la familia sigue con la
// misma bolsa. Si muere el último miembro, el hogar se extingue y su dinero
// pasa a los hogares de los hijos (o, si no hay, al tesoro público).
function die(w, p, cause) {
  p.alive = false;
  p.deathCause = cause;
  if (p.partnerId) {
    const q = w.people.find(x => x.id === p.partnerId);
    if (q) q.partnerId = null;
    p.partnerId = null;
  }
  const hh = hhOf(w, p);
  p.householdId = null;
  if (!hh) return "";
  hh.memberIds = hh.memberIds.filter(id => id !== p.id);
  if (livingMembers(w, hh).length === 0) {
    const heirs = childHouseholds(w, hh);
    const note = distributeEstate(w, hh, heirs);
    // la casa queda libre y se pondrá a la venta: con lo que se cobre se salda
    // primero su hipoteca pendiente y el resto es para los herederos (o el tesoro)
    if (hh.houseId) {
      const house = w.houses.find(h => h.id === hh.houseId);
      if (house) { house.ownerId = null; house.sellerIds = heirs.map(h => h.id); house.pendingDebt = hh.debt; }
    }
    hh.debt = 0;
    w.households = w.households.filter(h => h.id !== hh.id);
    return " El hogar se extingue." + note;
  }
  return "";
}

// Herencia de un hogar que se extingue: su dinero y sus depósitos en el banco
// pasan a los hogares de los hijos; si no hay, al tesoro público.
function distributeEstate(w, hh, heirs) {
  const amount = hh.wallet, dep = hh.deposit || 0;
  hh.wallet = 0; hh.deposit = 0;
  if (amount + dep <= 0.01) return "";
  heirs = heirs || childHouseholds(w, hh);
  if (heirs.length) {
    for (const h of heirs) { h.wallet += amount / heirs.length; h.deposit = (h.deposit || 0) + dep / heirs.length; }
    return ` ${Math.round(amount + dep)} 🐚 heredados por ${heirs.length} hogar/es.`;
  }
  w.treasury += amount; w.treasuryDeposit += dep; w.heirlessToTreasury += amount + dep;
  if (w.flows) w.flows.estates += amount;
  return ` Sin herederos: ${Math.round(amount + dep)} 🐚 pasan al tesoro.`;
}

// Un adulto deja su hogar de origen para fundar uno nuevo. Si era el último
// miembro vivo, se lleva el remanente de la bolsa familiar.
function leaveHousehold(w, p, newHH) {
  const old = hhOf(w, p);
  if (!old || old.id === newHH.id) return;
  old.memberIds = old.memberIds.filter(id => id !== p.id);
  p.householdId = null;
  if (livingMembers(w, old).length === 0) {
    newHH.wallet += old.wallet; old.wallet = 0;
    newHH.debt += old.debt; old.debt = 0;
    newHH.deposit = (newHH.deposit || 0) + (old.deposit || 0); old.deposit = 0;
    // su antigua casa se pone a la venta; el dinero será para su nuevo hogar
    if (old.houseId && old.houseId !== newHH.houseId) {
      const house = w.houses.find(h => h.id === old.houseId);
      if (house) { house.ownerId = null; house.sellerIds = [newHH.id]; house.pendingDebt = 0; }
    }
    w.households = w.households.filter(h => h.id !== old.id);
  }
}

// Un hogar compra una vivienda libre con una HIPOTECA. El banco solo presta si
// la cuota anual cabe en lo que la pareja puede ahorrar y si hay ahorro de las
// familias para prestar. Con el préstamo se paga la casa a su dueño: primero se
// salda la hipoteca pendiente del dueño anterior (vuelve a los ahorradores; si no
// alcanza, es una pérdida para ellos) y el resto va a sus herederos o, si la casa
// era pública o no tiene herederos, al tesoro.
function buyHouse(w, hh) {
  const house = w.houses.find(h => h.ownerId === null);
  if (!house) return false;
  if (!canAffordMortgage(w, w.priceHouse) || !fundLoan(w, w.priceHouse, w.priceFish)) {
    w.mortgagesDenied++;
    return false;
  }
  const loan = w.priceHouse;
  hh.debt += loan;
  w.mortgagesGranted++; w.flows.loans += loan;
  let proceeds = loan;
  const pending = house.pendingDebt || 0;
  const settle = Math.min(proceeds, pending);
  proceeds -= settle;
  if (settle > 0) { payDepositors(w, 0, settle); w.bankRepaid += settle; w.flows.bankRepaid += settle; }
  if (pending > settle) writeOff(w, pending - settle);
  const sellers = (house.sellerIds || []).map(id => w.households.find(h => h.id === id)).filter(Boolean);
  if (sellers.length) for (const s of sellers) s.wallet += proceeds / sellers.length;
  else { w.treasury += proceeds; w.flows.houseSales += proceeds; }
  house.sellerIds = null; house.pendingDebt = 0;
  house.ownerId = hh.fatherId || hh.motherId;
  hh.houseId = house.id;
  for (const id of [hh.fatherId, hh.motherId]) {
    const p = id ? w.people.find(x => x.id === id) : null;
    if (p) p.houseId = house.id;
  }
  return true;
}

function formFamilies(w) {
  // 1) Las parejas que viven con sus padres intentan comprar su propia casa
  for (const hh of [...w.households]) {
    if (hh.houseId) continue;
    const dad = hh.fatherId ? w.people.find(x => x.id === hh.fatherId) : null;
    const mom = hh.motherId ? w.people.find(x => x.id === hh.motherId) : null;
    if (!dad || !mom || !dad.alive || !mom.alive) continue;
    if (buyHouse(w, hh)) logMsg(w, `🔑 ${fullName(dad)} y ${fullName(mom)} consiguen hipoteca y se mudan a su casa.`);
  }

  // 2) Bodas
  const singlesM = alive(w).filter(p => stage(p) === "adult" && !p.partnerId && p.sex === "M").sort((a, b) => a.age - b.age);
  const singlesF = alive(w).filter(p => stage(p) === "adult" && !p.partnerId && p.sex === "F").sort((a, b) => a.age - b.age);

  while (singlesM.length && singlesF.length) {
    const m = singlesM.shift();
    const f = singlesF.shift();
    const hhM = hhOf(w, m), hhF = hhOf(w, f);
    if (hhM && hhF && hhM.id === hhF.id) continue; // mismo hogar (hermanos)

    // ¿Alguno ya tiene vivienda propia (viudo/a, soltero/a con casa)? Se mudan allí.
    const targetHH = (m.houseId && hhM) ? hhM : ((f.houseId && hhF) ? hhF : null);
    if (targetHH) {
      const mover = targetHH === hhM ? f : m;
      leaveHousehold(w, mover, targetHH);
      addToHousehold(targetHH, mover);
      targetHH.fatherId = m.id; targetHH.motherId = f.id;
      m.partnerId = f.id; f.partnerId = m.id;
      m.houseId = targetHH.houseId; f.houseId = targetHH.houseId;
      const house = w.houses.find(h => h.id === targetHH.houseId);
      if (house) house.ownerId = m.id;
      logMsg(w, `❤️ ${fullName(m)} y ${fullName(f)} se casan.`);
      continue;
    }

    // Ninguno tiene casa: se casan y forman su propio hogar (su propia economía).
    // Intentan comprar una vivienda con hipoteca; si no hay casa libre o el banco
    // no les presta, viven con sus padres hasta conseguirla.
    m.partnerId = f.id; f.partnerId = m.id;
    m.houseId = null; f.houseId = null;
    const newHH = makeHousehold(w, { houseId: null, wallet: 0, fatherId: m.id, motherId: f.id });
    leaveHousehold(w, m, newHH);
    leaveHousehold(w, f, newHH);
    addToHousehold(newHH, m); addToHousehold(newHH, f);
    if (buyHouse(w, newHH)) {
      logMsg(w, `❤️ ${fullName(m)} y ${fullName(f)} se casan, piden una hipoteca de ${Math.round(newHH.debt)} 🐚 y se mudan a su casa.`);
    } else {
      logMsg(w, `❤️ ${fullName(m)} y ${fullName(f)} se casan, pero sin vivienda propia: viven con sus padres.`);
    }
  }
}

// ¿Puede una pareja joven pagar la cuota anual de una hipoteca de `amount`?
// Capacidad = parte del excedente que generan dos adultos pescando (en caracolas).
function canAffordMortgage(w, amount) {
  const earners = 1 + (w.policy.womenWork ? 1 : CFG.HOME_PRODUCTION); // él + ella
  const surplusFish = Math.max(0, earners * (w.expCatch || CFG.BASE_CATCH) - 2 * CFG.NEED_ADULT);
  const capacity = CFG.LOAN_INCOME_SHARE * surplusFish * w.priceFish;
  const annualPayment = amount * (w.policy.interest / 100 + 1 / CFG.LOAN_TERM);
  return annualPayment <= capacity;
}

function births(w) {
  // La natalidad depende de la SITUACIÓN ECONÓMICA de cada familia:
  //   - la mujer del hogar debe ser fértil (menos de 45 años),
  //   - la familia debe poder comprar al menos 3 pescados y no estar pasando hambre,
  //   - cuanto más ahorro tenga (medido en años de comida para toda la familia),
  //     más probable es otro hijo.
  // Si el pescado escasea (sobrepesca, sequía), sube de precio, las familias se
  // empobrecen y nacen menos niños: la economía regula la población.
  const price = w.priceFish;
  const workBonus = w.policy.womenWork ? 1 : CFG.NONWORK_BIRTH_BONUS;
  // si la isla está cerca de su límite de comida, nacen menos niños
  const room = w.foodRoom != null ? w.foodRoom : 2;
  const scarcity = clamp((room - 1) / 0.3, 0, 1);
  if (scarcity <= 0) return;
  for (const hh of [...w.households]) {
    const mom = hh.motherId ? w.people.find(x => x.id === hh.motherId) : null;
    const dad = hh.fatherId ? w.people.find(x => x.id === hh.fatherId) : null;
    if (!mom || !mom.alive || !dad || !dad.alive) continue;
    if (mom.age < CFG.CHILD_MAX_AGE || mom.age >= CFG.FERTILE_MAX_AGE) continue;
    if (dad.age < CFG.CHILD_MAX_AGE) continue;
    if (w.day - mom.lastBirthDay < CFG.BIRTH_COOLDOWN) continue;
    if (hh.wallet < 3 * price) continue;
    const members = livingMembers(w, hh);
    if (members.some(m => m.hungryYears > 0)) continue;
    const famNeed = Math.max(1, members.reduce((s, m) => s + need(m), 0));
    // un hogar POBRE (no se alimenta solo y no tiene ahorro para cubrirlo) no
    // se puede permitir otro hijo
    const def = hh._deficit || 0;
    if (def > 0.01 && hh.wallet < CFG.RESERVE_YEARS * def * price) continue;
    // una familia que come bien y no es pobre tiene hijos; el ahorro lo hace más probable
    const savings = hh.wallet + (hh.deposit || 0);
    const prosperity = clamp(savings / (price * famNeed * CFG.PROSPERITY_YEARS), 0, 1);
    const houseFactor = hh.houseId ? 1 : CFG.NOHOUSE_BIRTH_FACTOR;
    if (Math.random() < CFG.BIRTH_CHANCE * (0.5 + 0.5 * prosperity) * workBonus * houseFactor * scarcity) {
      const child = makePerson({
        age: 0,
        parents: [dad.id, mom.id],
        surname: `${dad.surname.split(" ")[0]} ${mom.surname.split(" ")[0]}`,
      });
      dad.childrenIds.push(child.id);
      mom.childrenIds.push(child.id);
      mom.lastBirthDay = w.day;
      w.birthsYear = (w.birthsYear || 0) + 1;
      w.people.push(child);
      addToHousehold(hh, child);
      logMsg(w, `👶 Nace ${fullName(child)}.`);
    }
  }
}

// Inmigración: si la isla ofrece OPORTUNIDADES (casas libres, mar sano y poca
// pobreza), llega gente de fuera buscando una vida mejor. Es más probable cuanto
// más vacía y próspera está la isla. Llegan adultos jóvenes solteros, del sexo
// que más falta, con un pequeño ahorro (dinero que entra en la isla).
function immigration(w) {
  const living = alive(w);
  const pop = living.length;
  const free = w.houses.filter(h => h.ownerId === null).length;
  const seaRatio = w.seaFish / CFG.SEA_CAPACITY;
  const poverty = w.stats.povertyRate || 0;
  if (free < 1 || seaRatio < 0.6 || poverty > 25) return;
  const appeal = clamp((seaRatio - 0.6) / 0.3, 0, 1) * (1 - poverty / 25);
  const chance = appeal * (pop < 10 ? 0.5 : 0.08);
  if (Math.random() > chance) return;
  const singles = living.filter(p => stage(p) === "adult" && !p.partnerId);
  const sM = singles.filter(p => p.sex === "M").length, sF = singles.length - sM;
  const sex = sM > sF ? "F" : (sF > sM ? "M" : (Math.random() < 0.5 ? "M" : "F"));
  const p = makePerson({ age: rndInt(18, 30), sex });
  w.people.push(p);
  const savings = CFG.IMMIGRANT_SAVINGS_FISH * w.priceFish;
  makeHousehold(w, { members: [p], wallet: savings,
    fatherId: sex === "M" ? p.id : null, motherId: sex === "F" ? p.id : null });
  w.immigrants++; w.flows.immigration += savings;
  logMsg(w, `⛵ Llega a la isla ${fullName(p)} buscando una vida mejor.`);
}

// Exportar al ámbito global (lo usa app.js)
window.Island = { CFG, newWorld, step, stage, need, fullName, alive, totalMoney, walletOf, hhOf, setRetireAge };
