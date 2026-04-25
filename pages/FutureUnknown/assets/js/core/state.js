const defaultState = {
  player: {
    name: "",
    gender: null,
    tribe: null,
    faction: null,
    language: null,
    knownLanguages: [],
    homeSystem: null,
    homePlanet: null,
    created: false,
    resistance: 0,
    evasion: 0,
    modifiers: { salvage: 1, trade: 1, travel: 1, repair: 1, blackMarket: 1, scan: 1, research: 1 },
    level: 1,
    xp: 0,
    xpToNext: 100,
    energy: 14,
    energyMax: 100,
    health: 100,
    healthMax: 100,
    stamina: 6,
    staminaMax: 14,
    mood: 93,
    moodMax: 100,
    nutrition: 74,
    nutritionMax: 100,
    fitness: 68,
    fitnessMax: 100,
    credits: 152000
  },

  ship: {
    hull: 72,
    hullMax: 100,
    shield: 90,
    shieldMax: 100
  },

  inventory: {
    materials: {
      alloyPlates: 8,
      circuitBoards: 4,
      energyCells: 3,
      capacitors: 2
    },
    damagedComponents: [],
    repairedComponents: []
  },

  map: {
    currentSystem: "Solaris",
    currentPlanet: "Earth",
    travelling: false,
    destination: null,
    selectedDebrisId: null,
    systems: {
      Solaris: {
        scanned: 0,
        planets: [
          { name: "Earth", discovered: true, scanned: true, type: "Home", distance: 0, danger: 0, homeworld: true, safeZone: true, faction: "human" },
          { name: "Mars", discovered: true, scanned: true, type: "Mining", distance: 1, danger: 1, faction: "human" },
          { name: "X-17", discovered: false, scanned: false, type: "Unknown", distance: 2, danger: 2, faction: "human" },
          { name: "Nova Prime", discovered: true, scanned: true, type: "Trade", distance: 2, danger: 2, faction: "human" },
          { name: "Helios Minor", discovered: false, scanned: false, type: "Research", distance: 3, danger: 2, faction: "human" }
        ],
        debrisFields: []
      },
      "Aetherion": {
        scanned: 0,
        planets: [
          { name: "Lyra Prime", discovered: false, scanned: false, type: "Home", distance: 0, danger: 0, homeworld: true, safeZone: true, faction: "aetherian" },
          { name: "Veil Spire", discovered: false, scanned: false, type: "Research", distance: 2, danger: 1, faction: "aetherian" },
          { name: "Halo Reach", discovered: false, scanned: false, type: "Trade", distance: 3, danger: 2, faction: "aetherian" },
          { name: "Glass Meridian", discovered: false, scanned: false, type: "Unknown", distance: 4, danger: 3, faction: "aetherian" },
          { name: "Astra Vale", discovered: false, scanned: false, type: "Mining", distance: 5, danger: 4, faction: "aetherian" }
        ],
        debrisFields: []
      },
      "Grav Core": {
        scanned: 0,
        planets: [
          { name: "Tyris", discovered: false, scanned: false, type: "Home", distance: 0, danger: 0, homeworld: true, safeZone: true, faction: "gravari" },
          { name: "Iron Deep", discovered: false, scanned: false, type: "Mining", distance: 2, danger: 3, faction: "gravari" },
          { name: "Mass Fall", discovered: false, scanned: false, type: "Unknown", distance: 3, danger: 4, faction: "gravari" },
          { name: "Anchor Nine", discovered: false, scanned: false, type: "Trade", distance: 4, danger: 2, faction: "gravari" },
          { name: "Pressure Arc", discovered: false, scanned: false, type: "Research", distance: 5, danger: 5, faction: "gravari" }
        ],
        debrisFields: []
      },
      "Zyph Nexus": {
        scanned: 0,
        planets: [
          { name: "Virex", discovered: false, scanned: false, type: "Home", distance: 0, danger: 0, homeworld: true, safeZone: true, faction: "zypher" },
          { name: "Slip Bloom", discovered: false, scanned: false, type: "Research", distance: 2, danger: 2, faction: "zypher" },
          { name: "Cipher Drift", discovered: false, scanned: false, type: "Trade", distance: 3, danger: 2, faction: "zypher" },
          { name: "Needle Ring", discovered: false, scanned: false, type: "Unknown", distance: 4, danger: 4, faction: "zypher" },
          { name: "Blue Hollow", discovered: false, scanned: false, type: "Mining", distance: 5, danger: 3, faction: "zypher" }
        ],
        debrisFields: []
      },
      "Khar Void": {
        scanned: 0,
        planets: [
          { name: "Drak'thor", discovered: false, scanned: false, type: "Home", distance: 0, danger: 0, homeworld: true, safeZone: true, faction: "khartek" },
          { name: "Blood Forge", discovered: false, scanned: false, type: "Mining", distance: 2, danger: 5, faction: "khartek" },
          { name: "Rift Maw", discovered: false, scanned: false, type: "Unknown", distance: 3, danger: 6, faction: "khartek" },
          { name: "War Ledger", discovered: false, scanned: false, type: "Trade", distance: 4, danger: 4, faction: "khartek" },
          { name: "Ash Relay", discovered: false, scanned: false, type: "Research", distance: 5, danger: 5, faction: "khartek" }
        ],
        debrisFields: []
      },
      "Nex Hub": {
        scanned: 0,
        planets: [
          { name: "Orionis", discovered: false, scanned: false, type: "Home", distance: 0, danger: 0, homeworld: true, safeZone: true, faction: "nexari" },
          { name: "Ledger Port", discovered: false, scanned: false, type: "Trade", distance: 2, danger: 1, faction: "nexari" },
          { name: "Mint Glass", discovered: false, scanned: false, type: "Research", distance: 3, danger: 2, faction: "nexari" },
          { name: "Bond Reef", discovered: false, scanned: false, type: "Unknown", distance: 4, danger: 3, faction: "nexari" },
          { name: "Cargo Verge", discovered: false, scanned: false, type: "Mining", distance: 5, danger: 2, faction: "nexari" }
        ],
        debrisFields: []
      },
      "Alpha Centauri": {
        scanned: 0,
        planets: [
          { name: "Tau Centauri", discovered: false, scanned: false, type: "Home", distance: 10, danger: 0 },
          { name: "Epsilon Ray", discovered: false, scanned: false, type: "Mining", distance: 11, danger: 2 },
          { name: "B Real", discovered: false, scanned: false, type: "Unknown", distance: 12, danger: 5 },
          { name: "Helion Alpha", discovered: false, scanned: false, type: "Trade", distance: 12, danger: 3 },
          { name: "Wreckage", discovered: false, scanned: false, type: "Research", distance: 13, danger: 8 }
        ],
        debrisFields: []
      }
    }
  },

  travel: {
    active: false,
    fromPlanet: null,
    toPlanet: null,
    fromSystem: null,
    toSystem: null,
    progressMs: 0,
    durationMs: 0,
    startedAt: 0,
    timerId: null,
    pendingArrival: false,
    eventTriggered: false,
    mode: "planet"
  },

  events: {
    active: null
  },

  market: {
    listings: [
      {
        id: "lst_rations",
        name: "Crew Ration Crate",
        kind: "supply",
        fromPlanet: "Earth",
        price: 900,
        stock: 60,
        stockMax: 2000,
        baseStock: 10,
        restockMin: 20,
        restockMax: 50,
        description: "Packed nutrition bundles for long duty cycles.",
        contents: { nutrition: 18, mood: 2 }
      },
      {
        id: "lst_alloy",
        name: "Industrial Alloy Bundle",
        kind: "material",
        fromPlanet: "Mars",
        price: 2400,
        stock: 40,
        stockMax: 1000,
        baseStock: 40,
        restockMin: 6,
        restockMax: 16,
        description: "Dockyard surplus plates reclaimed from mining yards.",
        contents: { materials: { alloyPlates: 3 } }
      },
      {
        id: "lst_circuit",
        name: "Circuit Board Pack",
        kind: "material",
        fromPlanet: "Nova Prime",
        price: 3200,
        stock: 40,
        stockMax: 2500,
        baseStock: 40,
        restockMin: 8,
        restockMax: 18,
        description: "Trade-grade control boards sealed for freight transport.",
        contents: { materials: { circuitBoards: 2, capacitors: 1 } }
      },
      {
        id: "lst_energy",
        name: "Energy Cell Pallet",
        kind: "material",
        fromPlanet: "Nova Prime",
        price: 4100,
        stock: 30,
        stockMax: 3000,
        baseStock: 30,
        restockMin: 6,
        restockMax: 14,
        description: "A compact shipment of regulated ship cells.",
        contents: { materials: { energyCells: 2, capacitors: 1 } }
      },
      {
        id: "lst_med",
        name: "Med-Patch Locker",
        kind: "medical",
        fromPlanet: "Earth",
        price: 1800,
        stock: 30,
        stockMax: 1000,
        baseStock: 100,
        restockMin: 10,
        restockMax: 22,
        description: "Emergency recovery kit for crew rest cycles.",
        contents: { health: 12, mood: 3 }
      },
      {
        id: "lst_protein",
        name: "Protein Reserve Pack",
        kind: "supply",
        fromPlanet: "Nova Prime",
        price: 1400,
        stock: 4,
        stockMax: 10000,
        baseStock: 80,
        restockMin: 10,
        restockMax: 30,
        description: "Long-life protein slabs and hydration supplements for hungry crews.",
        contents: { nutrition: 24, fitness: 3, mood: 1 }
      }
    ],
    deliveries: [],
    lastRestockAt: Date.now(),
    restockIntervalMs: 120000
  },


  research: {
    labLevel: 1,
    activeId: null,
    activeStartedAt: 0,
    activeEndsAt: 0,
    activeDurationMs: 0,
    completed: {},
    levels: {
      energy_technology: 0
    }
  },

  settings: {
    passive: {
      energyRecoveryPer5Min: 1,
      healthRecoveryPer5Min: 5,
      staminaRecoveryPer5Min: 2,
      moodDecayPer24h: 10,
      nutritionDecayPerHour: 10,
      fitnessDecayPer2h: 10
    },
    market: {
      restockIntervalMs: 120000
    }
  },

  missions: {
    board: [],
    activeMissionId: null,
    completed: [],
    nextRefreshAt: 0,
    stats: {
      completed: 0
    }
  },

  meta: {
    saveVersion: 2,
    lastSavedAt: 0,
    lastLoadedAt: 0,
    warningFlags: {
      moodLow: false,
      moodCritical: false,
      nutritionLow: false,
      nutritionCritical: false,
      foodLow: false,
      foodEmpty: false
    }
  },

  ui: {
    currentPage: "dashboard",
    selectedPlanetName: null,
    selectedResearchId: null,
    logEntries: []
  }
};

const SAVE_KEY = "FU_SAVE_V2";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function mergeState(target, source) {
  if (!isPlainObject(source)) return target;

  Object.keys(source).forEach(key => {
    const incoming = source[key];

    if (Array.isArray(incoming)) {
      target[key] = deepClone(incoming);
      return;
    }

    if (isPlainObject(incoming)) {
      if (!isPlainObject(target[key])) {
        target[key] = {};
      }
      mergeState(target[key], incoming);
      return;
    }

    if (incoming !== undefined) {
      target[key] = incoming;
    }
  });

  return target;
}

const state = deepClone(defaultState);

function sanitiseLoadedState() {
  if (!state.meta) state.meta = deepClone(defaultState.meta);
  if (!state.meta.warningFlags) state.meta.warningFlags = deepClone(defaultState.meta.warningFlags);
  mergeState(state.meta.warningFlags, defaultState.meta.warningFlags);
  if (!state.ui) state.ui = deepClone(defaultState.ui);
  if (!Array.isArray(state.ui.logEntries)) state.ui.logEntries = [];
  if (typeof state.ui.selectedPlanetName !== "string" && state.ui.selectedPlanetName !== null) {
    state.ui.selectedPlanetName = null;
  }
  if (typeof state.ui.selectedResearchId !== "string" && state.ui.selectedResearchId !== null) {
    state.ui.selectedResearchId = null;
  }
  if (!state.research || typeof state.research !== "object") state.research = {};
  state.research = mergeState(deepClone(defaultState.research), state.research);
  if (!state.research.completed || typeof state.research.completed !== "object") state.research.completed = {};
  if (!state.research.levels || typeof state.research.levels !== "object") state.research.levels = {};
  state.research.levels = mergeState(deepClone(defaultState.research.levels), state.research.levels);
  if (typeof state.research.labLevel !== "number" || state.research.labLevel < 0) state.research.labLevel = defaultState.research.labLevel;
  if (typeof state.research.activeId !== "string" && state.research.activeId !== null) state.research.activeId = null;
  if (typeof state.research.activeStartedAt !== "number") state.research.activeStartedAt = 0;
  if (typeof state.research.activeEndsAt !== "number") state.research.activeEndsAt = 0;
  if (typeof state.research.activeDurationMs !== "number") state.research.activeDurationMs = 0;
  if (state.research.activeId && typeof getResearchEntry === "function") {
    const activeEntry = getResearchEntry(state.research.activeId);
    if (!activeEntry || (state.research.levels?.[activeEntry.key] || 0) >= activeEntry.level) {
      state.research.activeId = null;
      state.research.activeStartedAt = 0;
      state.research.activeEndsAt = 0;
      state.research.activeDurationMs = 0;
    } else if (!state.research.activeStartedAt || !state.research.activeEndsAt || !state.research.activeDurationMs) {
      const durationMs = typeof getResearchDurationMs === "function" ? getResearchDurationMs(activeEntry) : 0;
      state.research.activeDurationMs = durationMs;
      state.research.activeStartedAt = Date.now();
      state.research.activeEndsAt = state.research.activeStartedAt + durationMs;
    }
  }
  if (!state.settings) state.settings = deepClone(defaultState.settings);
  mergeState(state.settings, deepClone(defaultState.settings));
  if (!state.missions) state.missions = deepClone(defaultState.missions);
  mergeState(state.missions, deepClone(defaultState.missions));
  if (!state.market) state.market = deepClone(defaultState.market);
  if (!Array.isArray(state.market.listings)) state.market.listings = deepClone(defaultState.market.listings);
  if (!Array.isArray(state.market.deliveries)) state.market.deliveries = [];
  if (typeof state.market.lastRestockAt !== 'number') state.market.lastRestockAt = Date.now();
  if (typeof state.market.restockIntervalMs !== 'number') state.market.restockIntervalMs = state.settings.market.restockIntervalMs || defaultState.market.restockIntervalMs;
  state.settings.market.restockIntervalMs = state.market.restockIntervalMs;
  state.market.listings.forEach((listing, index) => {
    const base = defaultState.market.listings.find(item => item.id === listing.id) || defaultState.market.listings[index];
    if (base) mergeState(listing, deepClone(base));
    if (typeof listing.stock !== 'number') listing.stock = typeof listing.baseStock === 'number' ? listing.baseStock : 0;
    if (typeof listing.stockMax !== 'number' || listing.stockMax < listing.stock) listing.stockMax = Math.max(listing.stock, listing.baseStock || 0);
    if (typeof listing.baseStock !== 'number') listing.baseStock = Math.min(listing.stock, listing.stockMax);
    if (typeof listing.restockMin !== 'number') listing.restockMin = 0;
    if (typeof listing.restockMax !== 'number') listing.restockMax = listing.restockMin;
  });
  if (!state.travel) state.travel = deepClone(defaultState.travel);
  mergeState(state.travel, deepClone(defaultState.travel));
  state.travel.timerId = null;
  const p = state.player;
  ['energy','health','stamina','mood','nutrition','fitness'].forEach(key => {
    const maxKey = key + 'Max';
    if (typeof p[maxKey] !== 'number' || p[maxKey] <= 0) p[maxKey] = defaultState.player[maxKey];
    if (typeof p[key] !== 'number') p[key] = defaultState.player[key];
    p[key] = Math.max(0, Math.min(p[key], p[maxKey]));
  });
  if (!state.player.modifiers || typeof state.player.modifiers !== 'object') state.player.modifiers = deepClone(defaultState.player.modifiers);
  if (!Array.isArray(state.player.knownLanguages)) state.player.knownLanguages = [];
  if (state.player.homePlanet === "Drak\u2019thor") state.player.homePlanet = "Drak'thor";
  if (state.map?.currentPlanet === "Drak\u2019thor") state.map.currentPlanet = "Drak'thor";
  if (!state.player.faction && state.player.tribe) {
    const map = { humans: "human", engineers: "aetherian", scavengers: "gravari", traders: "nexari", nomads: "zypher" };
    state.player.faction = map[state.player.tribe] || "human";
  }
  if (state.player.faction && typeof FACTIONS !== "undefined" && FACTIONS[state.player.faction]) {
    if (!state.player.language) state.player.language = FACTIONS[state.player.faction].language;
    if (!state.player.homeSystem) state.player.homeSystem = FACTIONS[state.player.faction].homeSystem;
    if (!state.player.homePlanet) state.player.homePlanet = FACTIONS[state.player.faction].homeworld;
    if (!state.player.knownLanguages.includes(FACTIONS[state.player.faction].language)) state.player.knownLanguages.unshift(FACTIONS[state.player.faction].language);
  }
  if (!state.player.knownLanguages.includes("Common Tongue")) state.player.knownLanguages.push("Common Tongue");

  if (!state.map || !state.map.systems) state.map = deepClone(defaultState.map);
  Object.keys(defaultState.map.systems).forEach(systemName => {
    if (!state.map.systems[systemName]) state.map.systems[systemName] = deepClone(defaultState.map.systems[systemName]);
  });
}

function getSerializableState() {
  const snapshot = deepClone(state);
  snapshot.travel.timerId = null;
  snapshot.meta.saveVersion = 2;
  snapshot.meta.lastSavedAt = Date.now();
  return snapshot;
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(getSerializableState()));
    return true;
  } catch (error) {
    console.error("Failed to save FutureUnknown state.", error);
    return false;
  }
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);
    mergeState(state, deepClone(defaultState));
    mergeState(state, parsed);
    sanitiseLoadedState();
    state.meta.lastLoadedAt = Date.now();
    return true;
  } catch (error) {
    console.error("Failed to load FutureUnknown state.", error);
    return false;
  }
}

function resetSavedGame() {
  localStorage.removeItem(SAVE_KEY);
}
