function canUnderstandListing(listing) {
  const sourceFaction = getPlanetFaction(listing.fromPlanet);
  if (!sourceFaction || typeof FACTIONS === "undefined") return true;
  const requiredLang = FACTIONS[sourceFaction]?.language;
  return !requiredLang || state.player.knownLanguages.includes(requiredLang);
}

function blackMarketAllowed() {
  const planet = getPlanetByName(state.map.currentPlanet);
  return planet?.type === "Trade" || !planet?.safeZone;
}

function getModifiedPrice(basePrice, mode = "legal") {
  const mods = state.player.modifiers || {};
  const factor = mode === "black" ? ((mods.blackMarket || 1) * 1.5) : (mods.trade || 1);
  return Math.max(1, Math.floor(basePrice * factor));
}

function buyBlackMarketListing(listing) {
  if (!blackMarketAllowed()) {
    addLog("Black market access denied in this location.");
    return;
  }
  if (listing.stock <= 0) {
    addLog(`${listing.name} is out of stock.`);
    return;
  }
  const price = getModifiedPrice(listing.price, "black");
  if (state.player.credits < price) {
    addLog(`Not enough credits for black market purchase: ${listing.name}.`);
    return;
  }
  state.player.credits -= price;
  listing.stock -= 1;
  const destination = state.map.currentPlanet;
  const etaMs = Math.floor(getMarketDeliveryTimeMs(listing.fromPlanet, destination) * 1.5);
  const delivery = {
    id: uid('delivery'), listingId: listing.id, listingName: `${listing.name} [Black Market]`, fromPlanet: listing.fromPlanet,
    toPlanet: destination, remainingMs: etaMs, totalMs: etaMs, createdAt: Date.now(), endTime: Date.now() + etaMs,
    contents: JSON.parse(JSON.stringify(listing.contents || {}))
  };
  state.market.deliveries.push(delivery);
  addLog(`Black market order placed for ${listing.name}. Covert freight ETA ${formatDuration(etaMs)}.`);
  gainXp(12, 'Black market order');
  renderTopbar();
  if (typeof renderMarket === 'function' && state.ui.currentPage === 'market') renderMarket();
  saveGame();
}

function getMarketListing(listingId) {
  return state.market.listings.find(item => item.id === listingId) || null;
}

function getFoodSupplySummary() {
  const supplyListings = state.market.listings.filter(item => item.kind === 'supply');
  return {
    stock: supplyListings.reduce((sum, item) => sum + (item.stock || 0), 0),
    cap: supplyListings.reduce((sum, item) => sum + (item.stockMax || item.baseStock || item.stock || 0), 0)
  };
}

function restockMarket(force = false) {
  if (!state.market || !Array.isArray(state.market.listings)) return;
  const now = Date.now();
  if (!force && now - state.market.lastRestockAt < state.market.restockIntervalMs) return;
  state.market.lastRestockAt = now;

  state.market.listings.forEach(listing => {
    const gain = rand(listing.restockMin || 0, listing.restockMax || 0);
    const cap = typeof listing.stockMax === 'number' ? listing.stockMax : (listing.baseStock || listing.stock || 0);
    listing.stock = Math.min(cap, (listing.stock || 0) + gain);
  });

  addLog(`Market restocked at ${state.map.currentPlanet}.`);
}

function applyMarketContents(contents) {
  if (!contents) return;

  if (contents.materials) {
    Object.entries(contents.materials).forEach(([key, value]) => {
      state.inventory.materials[key] = (state.inventory.materials[key] || 0) + value;
      addLog(`Freight unloaded: ${formatComponentName(key)} x${value}.`);
    });
  }

  if (typeof contents.nutrition === 'number') {
    state.player.nutrition = clamp(state.player.nutrition + contents.nutrition, 0, state.player.nutritionMax);
    addLog(`Crew stores increased: Nutrition +${contents.nutrition}.`);
  }

  if (typeof contents.mood === 'number') {
    state.player.mood = clamp(state.player.mood + contents.mood, 0, state.player.moodMax);
    addLog(`Crew comfort improved: Mood +${contents.mood}.`);
  }

  if (typeof contents.health === 'number') {
    state.player.health = clamp(state.player.health + contents.health, 0, state.player.healthMax);
    addLog(`Medical supplies applied: Health +${contents.health}.`);
  }

  if (typeof contents.fitness === 'number') {
    state.player.fitness = clamp(state.player.fitness + contents.fitness, 0, state.player.fitnessMax);
    addLog(`Conditioning stores used: Fitness +${contents.fitness}.`);
  }
}

function buyMarketListing(listingId) {
  const listing = getMarketListing(listingId);

  if (!listing) {
    addLog('Listing not found.');
    return;
  }

  if (listing.stock <= 0) {
    addLog(`${listing.name} is out of stock.`);
    return;
  }

  if (!canUnderstandListing(listing)) {
    buyBlackMarketListing(listing);
    return;
  }

  const finalPrice = getModifiedPrice(listing.price, "legal");
  if (state.player.credits < finalPrice) {
    addLog(`Not enough credits for ${listing.name}.`);
    return;
  }

  state.player.credits -= finalPrice;
  listing.stock -= 1;

  const destination = state.map.currentPlanet;
  const etaMs = getMarketDeliveryTimeMs(listing.fromPlanet, destination);

  if (etaMs === 0) {
    addLog(`Purchased ${listing.name} locally at ${destination}. Immediate collection authorised.`);
    applyMarketContents(listing.contents);
    gainXp(8, 'Local market purchase');
  } else {
    const delivery = {
      id: uid('delivery'),
      listingId: listing.id,
      listingName: listing.name,
      fromPlanet: listing.fromPlanet,
      toPlanet: destination,
      remainingMs: etaMs,
      totalMs: etaMs,
      createdAt: Date.now(),
      endTime: Date.now() + etaMs,
      contents: JSON.parse(JSON.stringify(listing.contents || {}))
    };

    state.market.deliveries.push(delivery);
    addLog(`Purchased ${listing.name}. Cargo ship dispatched from ${listing.fromPlanet} to ${destination}. ETA ${formatDuration(etaMs)}.`);
    gainXp(10, 'Market order placed');
  }

  renderTopbar();
  navigate(state.ui.currentPage);
  saveGame();
}

function updateMarketPassive(deltaMs) {
  if (!state.market || !Array.isArray(state.market.deliveries) || state.market.deliveries.length === 0) {
    return;
  }

  const completed = [];

  const now = Date.now();

  state.market.deliveries.forEach(delivery => {
    if (delivery.endTime) {
      delivery.remainingMs = Math.max(0, delivery.endTime - now);
    } else {
      delivery.remainingMs = Math.max(0, delivery.remainingMs - deltaMs);
      delivery.endTime = now + delivery.remainingMs;
    }

    if (delivery.remainingMs === 0) {
      completed.push(delivery.id);
    }
  });

  if (completed.length === 0) {
    return;
  }

  completed.forEach(id => completeMarketDelivery(id));
}

function completeMarketDelivery(deliveryId) {
  const index = state.market.deliveries.findIndex(item => item.id === deliveryId);
  if (index === -1) return;

  const delivery = state.market.deliveries[index];
  state.market.deliveries.splice(index, 1);

  addLog(`Cargo ship arrived from ${delivery.fromPlanet}. Delivery complete: ${delivery.listingName}.`);
  applyMarketContents(delivery.contents);
  gainXp(12, 'Freight delivery received');
  if (typeof updateMissionProgress === "function") {
    updateMissionProgress("delivery_received", {
      deliveryId,
      fromPlanet: delivery.fromPlanet,
      toPlanet: delivery.toPlanet,
      listingId: delivery.listingId
    });
  }
  renderTopbar();
  navigate(state.ui.currentPage);
  saveGame();
}

function normalizeMarket(){
  for(const l of state.market.listings){
    if(typeof l.stock!=="number") l.stock = l.baseStock ?? 0;
    if(typeof l.stockMax!=="number"||l.stockMax===0) l.stockMax = Math.max(l.stock,1);
  }
}
normalizeMarket();
