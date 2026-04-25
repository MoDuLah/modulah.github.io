function rollChance(percent) {
  return Math.random() * 100 < percent;
}

function getTravelEnergyCost(distance) {
  return 3 + (distance * 2);
}

function getTravelTimeMs(distance) {
  return 2000 + (distance * 1500);
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function currentSystemData() {
  return state.map.systems[state.map.currentSystem];
}

function getLocationText() {
  return `${state.map.currentPlanet}, ${state.map.currentSystem}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getXpPercent() {
  return state.player.xpToNext > 0
    ? Math.floor((state.player.xp / state.player.xpToNext) * 100)
    : 0;
}

function pct(value, max) {
  return max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
}

function materialMeta(key) {
  const map = {
    alloyPlates: { label: "Alloy Plates", className: "material-alloy" },
    circuitBoards: { label: "Circuit Boards", className: "material-circuit" },
    energyCells: { label: "Energy Cells", className: "material-energy" },
    capacitors: { label: "Capacitors", className: "material-capacitor" }
  };
  return map[key] || { label: key, className: "" };
}

function planetClass(type, discovered = true) {
  if (!discovered) return "planet-unknown";
  const byType = {
    Home: "planet-home",
    Mining: "planet-mining",
    Trade: "planet-trade",
    Research: "planet-research"
  };
  return byType[type] || "planet-unknown";
}

function formatComponentName(key) {
  const names = {
    alloyPlates: "Alloy Plates",
    circuitBoards: "Circuit Boards",
    energyCells: "Energy Cells",
    capacitors: "Capacitors"
  };
  return names[key] || key;
}


function getPlanetByName(name) {
  return currentSystemData().planets.find(p => p.name === name) || null;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

function escapeJsString(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ");
}


function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getSystemNames() {
  return Object.keys(state.map.systems);
}

function findPlanetLocation(planetName) {
  for (const [systemName, system] of Object.entries(state.map.systems)) {
    const planet = system.planets.find(p => p.name === planetName);
    if (planet) return { systemName, planet };
  }
  return null;
}

function getSystemHopDistance(fromSystemName, toSystemName) {
  const names = getSystemNames();
  const fromIndex = names.indexOf(fromSystemName);
  const toIndex = names.indexOf(toSystemName);
  if (fromIndex === -1 || toIndex === -1) return 0;
  return Math.abs(fromIndex - toIndex);
}

function getEntryPlanetName(systemName) {
  const system = state.map.systems[systemName];
  if (!system || !Array.isArray(system.planets) || system.planets.length === 0) return null;
  return system.planets[0].name;
}

function getTravelRouteInfo(fromSystemName, fromPlanetName, toSystemName, toPlanetName) {
  const origin = findPlanetLocation(fromPlanetName);
  const target = findPlanetLocation(toPlanetName);
  const fromPlanetDistance = origin ? (origin.planet.distance || 0) : 0;
  const toPlanetDistance = target ? (target.planet.distance || 0) : 0;
  const systemHops = getSystemHopDistance(fromSystemName, toSystemName);
  const interSystemCost = systemHops * 12;
  const localCost = systemHops === 0 ? Math.abs(fromPlanetDistance - toPlanetDistance) : fromPlanetDistance + toPlanetDistance + 2;
  const distance = Math.max(0, localCost + interSystemCost);
  return {
    distance,
    systemHops,
    crossSystem: systemHops > 0
  };
}

function getMarketDeliveryTimeMs(fromPlanetName, toPlanetName) {
  const fromInfo = findPlanetLocation(fromPlanetName);
  const toInfo = findPlanetLocation(toPlanetName);
  if (!fromInfo || !toInfo) return 0;
  const route = getTravelRouteInfo(fromInfo.systemName, fromPlanetName, toInfo.systemName, toPlanetName);
  return route.distance === 0 ? 0 : 8000 + (route.distance * 2500);
}


function getPassiveSettings() {
  const passive = state.settings?.passive || {};
  return {
    energyRecoveryPer5Min: Number(passive.energyRecoveryPer5Min ?? 1),
    healthRecoveryPer5Min: Number(passive.healthRecoveryPer5Min ?? 5),
    staminaRecoveryPer5Min: Number(passive.staminaRecoveryPer5Min ?? 2),
    moodDecayPer24h: Number(passive.moodDecayPer24h ?? 10),
    nutritionDecayPerHour: Number(passive.nutritionDecayPerHour ?? 10),
    fitnessDecayPer2h: Number(passive.fitnessDecayPer2h ?? 10)
  };
}

function ratePerMs(amount, periodMs) {
  return periodMs > 0 ? amount / periodMs : 0;
}


function getPlanetFaction(planetName) {
  const info = findPlanetLocation(planetName);
  return info?.planet?.faction || null;
}
