function applyTribeEffects() {
  const p = state.player;
  p.modifiers = { salvage: 1, trade: 1, travel: 1, repair: 1, blackMarket: 1, scan: 1, research: 1 };

  const factionKey = p.faction || ({ humans: "human", engineers: "aetherian", scavengers: "gravari", traders: "nexari", nomads: "zypher" }[p.tribe]) || "human";
  p.faction = factionKey;

  if (typeof FACTIONS !== "undefined" && FACTIONS[factionKey]) {
    Object.assign(p.modifiers, FACTIONS[factionKey].modifiers || {});
    p.language = FACTIONS[factionKey].language;
    p.homeSystem = FACTIONS[factionKey].homeSystem;
    p.homePlanet = FACTIONS[factionKey].homeworld;
    if (!Array.isArray(p.knownLanguages)) p.knownLanguages = [];
    if (!p.knownLanguages.includes(p.language)) p.knownLanguages.unshift(p.language);
  }
}
