function buildInterceptionEvent(planet) {
  const outcome = resolveInterception(planet);
  const planetArg = escapeJsString(planet.name);

  return {
    type: "interception",
    title: "Interception Detected",
    text: `A hostile signal locks onto your ship near ${planet.name}.`,
    detail: "Choose how to respond before continuing the route.",
    choices: [
      { label: "Evade", action: `resolveInterceptionChoice('evade', '${planetArg}')`, variant: "btn-primary" },
      { label: "Hold Course", action: `resolveInterceptionChoice('hold', '${planetArg}')` },
      { label: "Emergency Burn", action: `resolveInterceptionChoice('burn', '${planetArg}')`, variant: "btn-danger" }
    ],
    outcome
  };
}

function resolveInterception(planet) {
  const outcomes = [
    {
      result: "escape",
      log: `You evaded the hostile contact and continued toward ${planet.name}.`
    },
    {
      result: "damage",
      log: `You took light hull damage while escaping the interception near ${planet.name}.`
    },
    {
      result: "delay",
      log: `The interception forced you off course. Travel time increased.`
    }
  ];

  return outcomes[Math.floor(Math.random() * outcomes.length)];
}

function resolveTravelEvent(planet) {
  const planetArg = escapeJsString(planet.name);
  const events = [
    {
      type: "debris",
      title: "Debris Field Detected",
      text: `Sensors pick up scattered wreckage on the route to ${planet.name}.`,
      detail: "You can mark it for later recovery or divert now.",
      choices: [
        { label: "Mark Coordinates", action: `resolveTravelChoice('debris_mark', '${planetArg}')`, variant: "btn-primary" },
        { label: "Approach Now", action: `resolveTravelChoice('debris_approach', '${planetArg}')` },
        { label: "Ignore", action: `resolveTravelChoice('ignore', '${planetArg}')` }
      ]
    },
    {
      type: "signal",
      title: "Unknown Signal",
      text: "A weak transmission appears briefly and then fades.",
      detail: "You may investigate, archive it, or ignore it.",
      choices: [
        { label: "Investigate", action: `resolveTravelChoice('signal_investigate', '${planetArg}')`, variant: "btn-primary" },
        { label: "Archive", action: `resolveTravelChoice('signal_archive', '${planetArg}')` },
        { label: "Ignore", action: `resolveTravelChoice('ignore', '${planetArg}')` }
      ]
    },
    {
      type: "discovery",
      title: "Route Discovery",
      text: `Your scanners refine local route data while approaching ${planet.name}.`,
      detail: "Your navigation systems can either store the data or optimise the route now.",
      choices: [
        { label: "Optimise Route", action: `resolveTravelChoice('discovery_optimize', '${planetArg}')`, variant: "btn-primary" },
        { label: "Store Data", action: `resolveTravelChoice('discovery_store', '${planetArg}')` }
      ]
    }
  ];

  return events[Math.floor(Math.random() * events.length)];
}

function getTravelEvent(planet) {
  if (!planet) return null;
  const danger = planet.danger || 0;
  const interceptionChance = 8 + (danger * 8);
  const eventChance = 20 + (danger * 5);

  if (rollChance(interceptionChance)) {
    return buildInterceptionEvent(planet);
  }

  if (rollChance(eventChance)) {
    return resolveTravelEvent(planet);
  }

  return null;
}

function resolveInterceptionChoice(choice, planetName) {
  const event = state.events.active;
  if (!event || event.type !== "interception") return;

  if (choice === "evade") {
    addLog("Evasive manoeuvres engaged.");
  } else if (choice === "hold") {
    addLog("Holding course and maintaining emission discipline.");
  } else if (choice === "burn") {
    if (state.player.energy >= 3) {
      state.player.energy -= 3;
      addLog("Emergency burn executed. Extra energy consumed.");
    } else {
      addLog("Insufficient energy for emergency burn. Proceeding with normal evasion.");
    }
  }

  const outcome = event.outcome;
  if (outcome.result === "damage") {
    state.ship.hull = Math.max(0, state.ship.hull - (choice === "burn" ? 8 : 15));
  }

  if (outcome.result === "delay") {
    state.travel.durationMs += choice === "burn" ? 1000 : 2500;
  }

  addLog(outcome.log);
  resumeTravel();
}

function resolveTravelChoice(choice, planetName) {
  const event = state.events.active;
  if (!event) return;

  if (choice === "debris_mark") {
    const field = createDebrisField(planetName, "Travel wreck signature");
    addLog(`Coordinates recorded. ${field.name} marked near ${field.near}.`);
  }

  if (choice === "debris_approach") {
    const field = createDebrisField(planetName, "Travel wreck signature");
    addLog(`Approaching wreckage. ${field.name} added to local salvage records.`);
    state.map.selectedDebrisId = field.id;
  }

  if (choice === "signal_investigate") {
    if (rollChance(55)) {
      const field = createDebrisField(planetName, "Signal trace anomaly");
      addLog(`The signal led to debris coordinates: ${field.name}.`);
    } else {
      state.ship.shield = Math.max(0, state.ship.shield - 8);
      addLog("The signal collapsed into static and overloaded your shields slightly.");
    }
  }

  if (choice === "signal_archive") {
    addLog("Signal archived to navigation records.");
  }

  if (choice === "discovery_optimize") {
    state.travel.durationMs = Math.max(state.travel.progressMs + 400, state.travel.durationMs - 1200);
    addLog("Route data applied. ETA reduced.");
  }

  if (choice === "discovery_store") {
    addLog("Navigation data stored for later charting.");
  }

  if (choice === "ignore") {
    addLog("Event ignored. Course maintained.");
  }

  if (choice === "debris_approach") {
    state.events.active = null;
    state.travel.active = false;
    state.travel.pendingArrival = false;
    state.map.travelling = false;
    clearTravelTimer();
    addLog(`Travel interrupted. You remain near ${state.map.currentPlanet} with salvage coordinates on record.`);
    renderTopbar();
    navigate("map");
    saveGame();
    return;
  }

  resumeTravel();
  saveGame();
}
