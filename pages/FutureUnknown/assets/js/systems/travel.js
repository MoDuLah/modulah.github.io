function clearTravelTimer() {
  if (state.travel.timerId) {
    clearInterval(state.travel.timerId);
    state.travel.timerId = null;
  }
}

function syncTravelState(now = Date.now(), allowEvents = true) {
  if (!state.travel.active) return;

  state.travel.progressMs = clamp(now - state.travel.startedAt, 0, state.travel.durationMs);

  if (allowEvents && !state.travel.eventTriggered && state.travel.progressMs >= state.travel.durationMs * 0.5) {
    state.travel.progressMs = Math.floor(state.travel.durationMs * 0.5);
    state.travel.startedAt = now - state.travel.progressMs;
    state.travel.eventTriggered = true;
    const targetSystem = state.map.systems[state.travel.toSystem || state.map.currentSystem] || currentSystemData();
    const planet = targetSystem.planets.find(p => p.name === state.travel.toPlanet);
    const event = getTravelEvent(planet);

    if (event) {
      state.events.active = event;
      state.travel.active = false;
      state.travel.pendingArrival = true;
      state.map.travelling = true;
      addLog(`${event.title}: ${event.text}`);
      clearTravelTimer();
      return;
    }
  }

  if (state.travel.progressMs >= state.travel.durationMs) {
    completeTravel();
  }
}

function startTravelTimer() {
  clearTravelTimer();

  state.travel.timerId = setInterval(() => {
    if (!state.travel.active) {
      clearTravelTimer();
      return;
    }

    const beforeActive = state.travel.active;
    syncTravelState(Date.now(), true);

    if (!beforeActive || !state.travel.active) {
      renderTopbar();
      navigate(state.ui.currentPage);
      saveGame();
      return;
    }

    renderTopbar();
    navigate(state.ui.currentPage);
  }, 200);
}

function completeTravel() {
  clearTravelTimer();
  state.map.currentSystem = state.travel.toSystem || state.map.currentSystem;
  state.map.currentPlanet = state.travel.toPlanet;
  state.map.travelling = false;
  state.map.destination = null;

  addLog(`Arrived at ${state.map.currentPlanet}.`);
  gainXp(8, "Travel completed");
  if (typeof updateMissionProgress === "function") {
    updateMissionProgress("travel_arrival", {
      planetName: state.map.currentPlanet,
      systemName: state.map.currentSystem,
      fromPlanet: state.travel.fromPlanet
    });
  }

  state.travel.active = false;
  state.travel.fromPlanet = null;
  state.travel.toPlanet = null;
  state.travel.fromSystem = null;
  state.travel.toSystem = null;
  state.travel.mode = 'planet';
  state.travel.progressMs = 0;
  state.travel.durationMs = 0;
  state.travel.startedAt = 0;
  state.travel.pendingArrival = false;
  state.travel.eventTriggered = false;

  renderTopbar();
  navigate(state.ui.currentPage);
  saveGame();
}

function resumeTravel() {
  state.events.active = null;
  if (state.travel.pendingArrival) {
    state.travel.active = true;
    state.travel.pendingArrival = false;
    state.map.travelling = true;
    state.travel.startedAt = Date.now() - state.travel.progressMs;
    startTravelTimer();
  }
  renderTopbar();
  navigate(state.ui.currentPage);
  saveGame();
}

function resumeTravelAfterLoad() {
  if (state.travel.active) {
    syncTravelState(Date.now(), true);
    if (state.travel.active) {
      state.travel.startedAt = Date.now() - state.travel.progressMs;
      startTravelTimer();
    }
  }
}

function travelTo(destination) {
  if (state.travel.active || state.events.active) {
    addLog("Already travelling or currently resolving an event.");
    return;
  }

  const system = currentSystemData();
  const planet = system.planets.find(p => p.name === destination);

  if (!planet) {
    addLog("Destination not found.");
    return;
  }

  const route = getTravelRouteInfo(state.map.currentSystem, state.map.currentPlanet, state.map.currentSystem, destination);
  const energyCost = getTravelEnergyCost(route.distance);
  const travelTime = getTravelTimeMs(route.distance);

  if (state.player.energy < energyCost) {
    addLog(`Not enough energy. Required: ${energyCost}.`);
    return;
  }

  state.map.travelling = true;
  state.map.destination = destination;
  state.player.energy -= energyCost;

  state.travel.active = true;
  state.travel.fromPlanet = state.map.currentPlanet;
  state.travel.toPlanet = destination;
  state.travel.fromSystem = state.map.currentSystem;
  state.travel.toSystem = state.map.currentSystem;
  state.travel.mode = 'planet';
  state.travel.progressMs = 0;
  state.travel.durationMs = travelTime;
  state.travel.startedAt = Date.now();
  state.travel.pendingArrival = false;
  state.travel.eventTriggered = false;

  addLog(`Departed ${state.map.currentPlanet}. Destination: ${destination}.`);
  renderTopbar();
  navigate(state.ui.currentPage);
  startTravelTimer();
  saveGame();
}


function jumpToSystem(systemName) {
  if (state.travel.active || state.events.active) {
    addLog("Already travelling or currently resolving an event.");
    return;
  }
  if (!state.map.systems[systemName] || systemName === state.map.currentSystem) {
    addLog("System jump unavailable.");
    return;
  }
  const destinationPlanet = getEntryPlanetName(systemName);
  const route = getTravelRouteInfo(state.map.currentSystem, state.map.currentPlanet, systemName, destinationPlanet);
  const energyCost = getTravelEnergyCost(route.distance);
  const travelTime = getTravelTimeMs(route.distance);
  if (state.player.energy < energyCost) {
    addLog(`Not enough energy. Required: ${energyCost}.`);
    return;
  }
  state.map.travelling = true;
  state.map.destination = `${destinationPlanet}, ${systemName}`;
  state.player.energy -= energyCost;
  state.travel.active = true;
  state.travel.fromPlanet = state.map.currentPlanet;
  state.travel.toPlanet = destinationPlanet;
  state.travel.fromSystem = state.map.currentSystem;
  state.travel.toSystem = systemName;
  state.travel.mode = 'system';
  state.travel.progressMs = 0;
  state.travel.durationMs = travelTime;
  state.travel.startedAt = Date.now();
  state.travel.pendingArrival = false;
  state.travel.eventTriggered = false;
  const targetSystem = state.map.systems[systemName];
  if (targetSystem && targetSystem.planets[0]) {
    targetSystem.planets[0].discovered = true;
    targetSystem.planets[0].scanned = true;
  }
  addLog(`Jump initiated from ${state.map.currentSystem} to ${systemName}. Destination: ${destinationPlanet}.`);
  renderTopbar();
  navigate(state.ui.currentPage);
  startTravelTimer();
  saveGame();
}




const _oldGetTravelTimeMs = getTravelTimeMs;
getTravelTimeMs = function(distance){
  return _oldGetTravelTimeMs(distance) * (state.player.modifiers?.travel || 1);
};
