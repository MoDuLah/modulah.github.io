const RESEARCH_CATALOG = {
  energy_technology_1: {
    id: "energy_technology_1",
    key: "energy_technology",
    level: 1,
    tier: 1,
    category: "Core Systems",
    name: "Energy Technology I",
    costs: {
      materials: {
        alloyPlates: 2,
        circuitBoards: 2,
        energyCells: 1,
        capacitors: 1
      },
      energy: 5
    },
    requires: {
      labLevel: 1,
      research: []
    },
    description: "Stabilises shipboard power routing and opens the first serious upgrade paths.",
    detail: "Your crew rewires aging distribution nodes into a cleaner energy lattice. Once complete, more advanced propulsion and shield theory stop being guesswork.",
    effects: [
      "Unlocks early propulsion and shield research",
      "Establishes the first dependable power backbone"
    ]
  },
  scanner_calibration_1: {
    id: "scanner_calibration_1",
    key: "scanner_calibration",
    level: 1,
    tier: 1,
    category: "Exploration",
    name: "Scanner Calibration I",
    costs: {
      materials: {
        alloyPlates: 1,
        circuitBoards: 2,
        energyCells: 1
      },
      energy: 4
    },
    requires: {
      labLevel: 1,
      research: []
    },
    description: "Improves baseline sensor coherence for cleaner scans and less phantom noise.",
    detail: "The ship's scan array learns to reject low-grade interference, letting faint anomalies resolve into usable signatures.",
    effects: [
      "Unlocks deeper exploration research",
      "Sharpens signal quality for later scan upgrades"
    ]
  },
  cargo_protocols_1: {
    id: "cargo_protocols_1",
    key: "cargo_protocols",
    level: 1,
    tier: 1,
    category: "Commerce",
    name: "Cargo Protocols I",
    costs: {
      materials: {
        alloyPlates: 1,
        circuitBoards: 1,
        energyCells: 1,
        capacitors: 1
      },
      energy: 3
    },
    requires: {
      labLevel: 1,
      research: []
    },
    description: "Standardises manifests, docking validation, and container handling logic.",
    detail: "Trade stops become less chaotic once the ship can reconcile cargo records, route priorities, and receipt signatures in one pass.",
    effects: [
      "Unlocks commerce prediction and network research",
      "Creates a foundation for smarter freight management"
    ]
  },
  field_repairs_1: {
    id: "field_repairs_1",
    key: "field_repairs",
    level: 1,
    tier: 1,
    category: "Engineering",
    name: "Field Repairs I",
    costs: {
      materials: {
        alloyPlates: 2,
        circuitBoards: 1,
        capacitors: 1
      },
      energy: 4
    },
    requires: {
      labLevel: 1,
      research: []
    },
    description: "Turns improvised patchwork into a documented repair doctrine for shipboard crews.",
    detail: "Your engineers catalogue reliable emergency fixes for hull plating, relay damage, and short-cycle component swaps.",
    effects: [
      "Unlocks shield tuning and salvage automation",
      "Improves the crew's ability to think in modular repairs"
    ]
  },
  combustion_drive_1: {
    id: "combustion_drive_1",
    key: "combustion_drive",
    level: 1,
    tier: 2,
    category: "Navigation",
    name: "Combustion Drive I",
    costs: {
      materials: {
        alloyPlates: 2,
        circuitBoards: 1,
        energyCells: 2,
        capacitors: 1
      },
      energy: 6
    },
    requires: {
      labLevel: 1,
      research: [
        { key: "energy_technology", level: 1 }
      ]
    },
    description: "Refines burn timing and injector control for more disciplined acceleration windows.",
    detail: "Once power delivery becomes stable, the drive team can start shaping thrust curves instead of brute-forcing every launch.",
    effects: [
      "Unlocks higher-order navigation research",
      "Feeds into impulse theory and route efficiency"
    ]
  },
  salvage_drones_1: {
    id: "salvage_drones_1",
    key: "salvage_drones",
    level: 1,
    tier: 2,
    category: "Engineering",
    name: "Salvage Drones I",
    costs: {
      materials: {
        alloyPlates: 2,
        circuitBoards: 2,
        energyCells: 1,
        capacitors: 1
      },
      energy: 6
    },
    requires: {
      labLevel: 1,
      research: [
        { key: "scanner_calibration", level: 1 },
        { key: "field_repairs", level: 1 }
      ]
    },
    description: "Deploys small autonomous frames to index and strip reachable wreckage faster.",
    detail: "The drones are not elegant, but they can hold position in unstable debris fields long enough to tag valuables and bring them home.",
    effects: [
      "Unlocks advanced scanning and modular repair research",
      "Makes salvage operations strategically worth chasing"
    ]
  },
  market_forecasting_1: {
    id: "market_forecasting_1",
    key: "market_forecasting",
    level: 1,
    tier: 2,
    category: "Commerce",
    name: "Market Forecasting I",
    costs: {
      materials: {
        alloyPlates: 1,
        circuitBoards: 2,
        energyCells: 1,
        capacitors: 1
      },
      energy: 4
    },
    requires: {
      labLevel: 1,
      research: [
        { key: "cargo_protocols", level: 1 }
      ]
    },
    description: "Begins modelling supply swings and route timing across nearby trade hubs.",
    detail: "By watching repeat freight cycles, the ship can start anticipating shortages, surpluses, and which lanes matter most.",
    effects: [
      "Unlocks networked trade research",
      "Improves strategic visibility on freight routes"
    ]
  },
  shield_tuning_1: {
    id: "shield_tuning_1",
    key: "shield_tuning",
    level: 1,
    tier: 2,
    category: "Defense",
    name: "Shield Tuning I",
    costs: {
      materials: {
        alloyPlates: 2,
        circuitBoards: 2,
        energyCells: 1,
        capacitors: 2
      },
      energy: 7
    },
    requires: {
      labLevel: 1,
      research: [
        { key: "energy_technology", level: 1 },
        { key: "field_repairs", level: 1 }
      ]
    },
    description: "Optimises shield frequency responses so incoming stress spreads instead of spiking.",
    detail: "The barrier becomes less brittle once your crew can tune its response curve around real combat telemetry instead of factory defaults.",
    effects: [
      "Unlocks high-end energy and barrier research",
      "Builds the foundation for more resilient defenses"
    ]
  },
  energy_technology_2: {
    id: "energy_technology_2",
    key: "energy_technology",
    level: 2,
    tier: 3,
    category: "Core Systems",
    name: "Energy Technology II",
    costs: {
      materials: {
        alloyPlates: 3,
        circuitBoards: 3,
        energyCells: 2,
        capacitors: 2
      },
      energy: 8
    },
    requires: {
      labLevel: 1,
      research: [
        { key: "energy_technology", level: 1 },
        { key: "combustion_drive", level: 1 },
        { key: "shield_tuning", level: 1 }
      ]
    },
    description: "Deepens your control over power buffering, surge routing, and high-load distribution.",
    detail: "At this level the ship stops treating every subsystem like an isolated drain and starts behaving like a coordinated energy organism.",
    effects: [
      "Unlocks impulse drive and hardlight barrier research",
      "Marks the jump from improvised upgrades to deliberate systems engineering"
    ]
  },
  scanner_calibration_2: {
    id: "scanner_calibration_2",
    key: "scanner_calibration",
    level: 2,
    tier: 3,
    category: "Exploration",
    name: "Scanner Calibration II",
    costs: {
      materials: {
        alloyPlates: 2,
        circuitBoards: 3,
        energyCells: 1,
        capacitors: 1
      },
      energy: 6
    },
    requires: {
      labLevel: 1,
      research: [
        { key: "scanner_calibration", level: 1 },
        { key: "salvage_drones", level: 1 }
      ]
    },
    description: "Pushes the array into deep-spectrum work, where hidden anomalies start surfacing reliably.",
    detail: "Drone telemetry feeds back into the scanner stack, giving your instruments enough context to separate wreckage, weather, and genuine anomalies.",
    effects: [
      "Unlocks anomaly mapping research",
      "Improves confidence when reading distant or unstable signals"
    ]
  },
  trade_networks_1: {
    id: "trade_networks_1",
    key: "trade_networks",
    level: 1,
    tier: 3,
    category: "Commerce",
    name: "Trade Networks I",
    costs: {
      materials: {
        alloyPlates: 2,
        circuitBoards: 2,
        energyCells: 2,
        capacitors: 1
      },
      energy: 6
    },
    requires: {
      labLevel: 1,
      research: [
        { key: "market_forecasting", level: 1 },
        { key: "scanner_calibration", level: 1 }
      ]
    },
    description: "Connects freight predictions with navigational awareness to form real route intelligence.",
    detail: "Commerce stops being local bargaining and becomes a systems problem: timing, visibility, and access across multiple worlds.",
    effects: [
      "Unlocks autonomous convoy planning",
      "Creates the groundwork for longer, smarter supply chains"
    ]
  },
  modular_repairs_1: {
    id: "modular_repairs_1",
    key: "modular_repairs",
    level: 1,
    tier: 3,
    category: "Engineering",
    name: "Modular Repairs I",
    costs: {
      materials: {
        alloyPlates: 3,
        circuitBoards: 1,
        energyCells: 2,
        capacitors: 2
      },
      energy: 7
    },
    requires: {
      labLevel: 1,
      research: [
        { key: "field_repairs", level: 1 },
        { key: "salvage_drones", level: 1 },
        { key: "shield_tuning", level: 1 }
      ]
    },
    description: "Repackages damage control around swappable modules instead of one-off fixes.",
    detail: "Once salvage and shielding teams share the same schematics, the ship can repair around known modules instead of improvising every single recovery.",
    effects: [
      "Improves the long-term value of recovered components",
      "Feeds into heavier infrastructure and defense work"
    ]
  },
  impulse_drive_1: {
    id: "impulse_drive_1",
    key: "impulse_drive",
    level: 1,
    tier: 3,
    category: "Navigation",
    name: "Impulse Drive I",
    costs: {
      materials: {
        alloyPlates: 3,
        circuitBoards: 2,
        energyCells: 2,
        capacitors: 2
      },
      energy: 8
    },
    requires: {
      labLevel: 1,
      research: [
        { key: "combustion_drive", level: 1 },
        { key: "energy_technology", level: 2 }
      ]
    },
    description: "Introduces higher-intensity thrust windows that hold together under sustained routing load.",
    detail: "This is where propulsion research stops trimming edges and starts rewriting how the ship crosses dangerous distances.",
    effects: [
      "Unlocks anomaly mapping and autonomous convoy research",
      "Forms the late-midgame backbone for long-haul movement"
    ]
  },
  anomaly_mapping_1: {
    id: "anomaly_mapping_1",
    key: "anomaly_mapping",
    level: 1,
    tier: 4,
    category: "Exploration",
    name: "Anomaly Mapping I",
    costs: {
      materials: {
        alloyPlates: 3,
        circuitBoards: 3,
        energyCells: 2,
        capacitors: 2
      },
      energy: 9
    },
    requires: {
      labLevel: 1,
      research: [
        { key: "scanner_calibration", level: 2 },
        { key: "impulse_drive", level: 1 }
      ]
    },
    description: "Builds a working atlas of unstable signatures, hidden lanes, and recurring false positives.",
    detail: "Instead of treating anomalies as one-off curiosities, the ship begins recognising them as a structured layer of the frontier.",
    effects: [
      "Defines the top of the exploration branch",
      "Prepares the command layer for truly remote expeditions"
    ]
  },
  autonomous_convoys_1: {
    id: "autonomous_convoys_1",
    key: "autonomous_convoys",
    level: 1,
    tier: 4,
    category: "Commerce",
    name: "Autonomous Convoys I",
    costs: {
      materials: {
        alloyPlates: 3,
        circuitBoards: 3,
        energyCells: 3,
        capacitors: 2
      },
      energy: 9
    },
    requires: {
      labLevel: 1,
      research: [
        { key: "trade_networks", level: 1 },
        { key: "impulse_drive", level: 1 }
      ]
    },
    description: "Combines trade intelligence and propulsion planning into self-directed convoy doctrine.",
    detail: "Freight traffic becomes something you orchestrate instead of merely reacting to, with routing logic that can scale beyond one captain's attention span.",
    effects: [
      "Caps the commerce branch",
      "Points toward a future of persistent inter-system freight play"
    ]
  },
  hardlight_barriers_1: {
    id: "hardlight_barriers_1",
    key: "hardlight_barriers",
    level: 1,
    tier: 4,
    category: "Defense",
    name: "Hardlight Barriers I",
    costs: {
      materials: {
        alloyPlates: 3,
        circuitBoards: 2,
        energyCells: 3,
        capacitors: 3
      },
      energy: 10
    },
    requires: {
      labLevel: 1,
      research: [
        { key: "shield_tuning", level: 1 },
        { key: "energy_technology", level: 2 }
      ]
    },
    description: "Turns shield theory into shaped barrier architecture that can hold under concentrated pressure.",
    detail: "What began as tuning ends as construction: a defensive wall you can deliberately shape, reinforce, and trust in hostile space.",
    effects: [
      "Caps the defensive branch",
      "Creates the first believable path to elite survivability systems"
    ]
  }
};

const RESEARCH_CATEGORY_ORDER = [
  "Core Systems",
  "Exploration",
  "Commerce",
  "Engineering",
  "Navigation",
  "Defense"
];

const RESEARCH_BASE_DURATION_MS = 3 * 60 * 1000;
const RESEARCH_TIER_DURATION_GROWTH = 2.5;
const RESEARCH_LEVEL_DURATION_GROWTH = 1.6;
const RESEARCH_MIN_DURATION_MS = 30 * 1000;

function getResearchEntries() {
  return Object.values(RESEARCH_CATALOG).sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const categoryDiff = RESEARCH_CATEGORY_ORDER.indexOf(a.category) - RESEARCH_CATEGORY_ORDER.indexOf(b.category);
    if (categoryDiff !== 0) return categoryDiff;
    return a.name.localeCompare(b.name);
  });
}

function getResearchEntry(id) {
  return RESEARCH_CATALOG[id] || null;
}

function getResearchLevel(key) {
  return state.research?.levels?.[key] || 0;
}

function getResearchEntryByKeyLevel(key, level) {
  return getResearchEntries().find(entry => entry.key === key && entry.level === level) || null;
}

function getResearchBaseDurationMs(entry) {
  if (!entry) return 0;
  const tierScale = Math.pow(RESEARCH_TIER_DURATION_GROWTH, Math.max(0, (entry.tier || 1) - 1));
  const levelScale = Math.pow(RESEARCH_LEVEL_DURATION_GROWTH, Math.max(0, (entry.level || 1) - 1));
  return Math.round(RESEARCH_BASE_DURATION_MS * tierScale * levelScale);
}

function getResearchDurationMs(entry) {
  if (!entry) return 0;
  const modifier = Math.max(0.25, state.player?.modifiers?.research || 1);
  return Math.max(RESEARCH_MIN_DURATION_MS, Math.round(getResearchBaseDurationMs(entry) / modifier));
}

function getResearchRemainingMs(entry, now = Date.now()) {
  if (!entry || state.research?.activeId !== entry.id) return 0;
  return Math.max(0, (state.research.activeEndsAt || now) - now);
}

function getResearchProgressPercent(entry, now = Date.now()) {
  if (!entry) return 0;
  if (getResearchLevel(entry.key) >= entry.level) return 100;
  if (state.research?.activeId !== entry.id) return 0;

  const startedAt = state.research.activeStartedAt || now;
  const durationMs = state.research.activeDurationMs || getResearchDurationMs(entry);
  if (durationMs <= 0) return 0;
  return clamp(((now - startedAt) / durationMs) * 100, 0, 100);
}

function getActiveResearchEntry() {
  return state.research?.activeId ? getResearchEntry(state.research.activeId) : null;
}

function getResearchRequirementLabels(entry) {
  if (!entry) return [];
  const labels = [`Research Lab (Level ${entry.requires?.labLevel || 1})`];
  (entry.requires?.research || []).forEach(requirement => {
    const source = getResearchEntryByKeyLevel(requirement.key, requirement.level);
    labels.push(source ? source.name : `${requirement.key} ${requirement.level}`);
  });
  return labels;
}

function getResearchUnlocks(entry) {
  if (!entry) return [];
  return getResearchEntries().filter(candidate =>
    (candidate.requires?.research || []).some(requirement =>
      requirement.key === entry.key && requirement.level === entry.level
    )
  );
}

function hasResearchRequirements(entry) {
  if (!entry) return false;
  const requiredLabLevel = entry.requires?.labLevel || 1;
  const meetsLabLevel = (state.research?.labLevel || 0) >= requiredLabLevel;
  const meetsResearch = (entry.requires?.research || []).every(requirement =>
    getResearchLevel(requirement.key) >= requirement.level
  );
  return meetsLabLevel && meetsResearch;
}

function getResearchMaterialCosts(entry) {
  if (!entry || !entry.costs) return {};
  if (entry.costs.materials) return entry.costs.materials;
  return Object.fromEntries(Object.entries(entry.costs).filter(([key]) => key !== "energy"));
}

function formatResearchCost(entry) {
  if (!entry) return "Unavailable";
  const materialText = Object.entries(getResearchMaterialCosts(entry))
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => `${formatComponentName(key)} x${amount}`);
  if ((entry.costs?.energy || 0) > 0) {
    materialText.push(`Energy x${entry.costs.energy}`);
  }
  return materialText.length > 0 ? materialText.join(", ") : "No resource cost";
}

function canAffordResearch(entry) {
  if (!entry) return false;
  const inv = state.inventory?.materials || {};
  const hasMaterials = Object.entries(getResearchMaterialCosts(entry))
    .every(([key, amount]) => (inv[key] || 0) >= amount);
  return hasMaterials && state.player.energy >= (entry.costs.energy || 0);
}

function getResearchStatus(entry) {
  if (!entry) return "unknown";
  const currentLevel = getResearchLevel(entry.key);
  if (currentLevel >= entry.level) return "completed";
  if (state.research?.activeId === entry.id) return "active";
  if (!hasResearchRequirements(entry)) return "locked";
  if (!canAffordResearch(entry)) return "blocked";
  if (state.research?.activeId) return "busy";
  return "available";
}
