const FACTIONS = {
  human: {
    name: "Human",
    language: "Common Tongue",
    homeSystem: "Solaris",
    homeworld: "Earth",
    modifiers: { trade: 0.95, salvage: 1.05 }
  },

  aetherian: {
    name: "Aetherian",
    language: "Aether Script",
    homeSystem: "Aetherion",
    homeworld: "Lyra Prime",
    modifiers: { research: 1.2, scan: 1.15 }
  },

  gravari: {
    name: "Gravari",
    language: "Grav Dialect",
    homeSystem: "Grav Core",
    homeworld: "Tyris",
    modifiers: { repair: 1.2, salvage: 1.1 }
  },

  zypher: {
    name: "Zypher",
    language: "Zyph Code",
    homeSystem: "Zyph Nexus",
    homeworld: "Virex",
    modifiers: { scan: 1.2, travel: 0.85 }
  },

  khartek: {
    name: "Khar’tek",
    language: "War Cant",
    homeSystem: "Khar Void",
    homeworld: "Drak'thor",
    modifiers: { repair: 1.15, blackMarket: 0.9 }
  },

  nexari: {
    name: "Nexari",
    language: "Trade Lexicon",
    homeSystem: "Nex Hub",
    homeworld: "Orionis",
    modifiers: { trade: 0.85, blackMarket: 0.8 }
  }
};
