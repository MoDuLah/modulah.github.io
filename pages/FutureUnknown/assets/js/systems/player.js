function gainXp(amount, source = "Activity") {
  if (amount <= 0) return;

  state.player.xp += amount;
  addLog(`+${amount} XP • ${source}`);

  while (state.player.xp >= state.player.xpToNext) {
    state.player.xp -= state.player.xpToNext;
    state.player.level += 1;
    state.player.xpToNext = Math.floor(state.player.xpToNext * 1.2);
    state.player.energyMax += 4;
    state.player.healthMax += 3;
    state.player.staminaMax += 1;
    state.player.moodMax += 1;
    state.player.nutritionMax += 1;
    state.player.fitnessMax += 1;
    state.player.energy = state.player.energyMax;
    state.player.health = state.player.healthMax;
    state.player.stamina = state.player.staminaMax;
    state.player.mood = clamp(state.player.mood + 8, 0, state.player.moodMax);
    addLog(`Level up! You reached level ${state.player.level}. Core reserves increased.`);
  }
}

function feedPlayer() {
  if (state.player.credits < 120) {
    addLog("Not enough credits to buy rations.");
    return;
  }

  state.player.credits -= 120;
  state.player.nutrition = clamp(state.player.nutrition + 22, 0, state.player.nutritionMax);
  state.player.mood = clamp(state.player.mood + 4, 0, state.player.moodMax);
  gainXp(6, "Meal break");
  addLog("Rations consumed. Nutrition restored.");
  renderTopbar();
  navigate(state.ui.currentPage);
  saveGame();
}

function exercisePlayer() {
  if (state.travel.active || state.events.active) {
    addLog("Cannot exercise while travelling or during an active event.");
    return;
  }

  if (state.player.energy < 3 || state.player.stamina < 2) {
    addLog("Not enough energy or stamina to exercise.");
    return;
  }

  state.player.energy -= 3;
  state.player.stamina -= 2;
  state.player.fitness = clamp(state.player.fitness + 10, 0, state.player.fitnessMax);
  state.player.mood = clamp(state.player.mood + 6, 0, state.player.moodMax);
  gainXp(10, "Exercise");
  addLog("Training complete. Fitness improved.");
  renderTopbar();
  navigate(state.ui.currentPage);
  saveGame();
}

function startMission() {
  if (state.player.energy < 4) {
    addLog("Not enough energy to start the mission.");
    return;
  }

  state.player.energy -= 4;
  addLog("Mission launched. Deeper expedition systems come next.");
  gainXp(18, "Mission start");
  renderTopbar();
  saveGame();
}

function conductResearch(researchId = "energy_technology_1") {
  const entry = typeof getResearchEntry === "function" ? getResearchEntry(researchId) : null;
  if (!entry) {
    addLog("Research entry unavailable.");
    return;
  }

  if (typeof updateResearchProgress === "function") updateResearchProgress();

  if (state.research.activeId) {
    const active = typeof getActiveResearchEntry === "function" ? getActiveResearchEntry() : null;
    addLog(active ? `${active.name} is already in progress.` : "The research lab is already occupied.");
    return;
  }

  if ((state.research.levels?.[entry.key] || 0) >= entry.level) {
    addLog(`${entry.name} already completed.`);
    return;
  }

  if (!hasResearchRequirements(entry)) {
    addLog("Research Lab requirement not met.");
    return;
  }

  if (!canAffordResearch(entry)) {
    addLog("Not enough resources for this research.");
    return;
  }

  Object.entries(getResearchMaterialCosts(entry)).forEach(([key, amount]) => {
    state.inventory.materials[key] = Math.max(0, (state.inventory.materials[key] || 0) - amount);
  });
  state.player.energy = clamp(state.player.energy - (entry.costs.energy || 0), 0, state.player.energyMax);

  const now = Date.now();
  const durationMs = typeof getResearchDurationMs === "function" ? getResearchDurationMs(entry) : 0;
  state.research.activeId = entry.id;
  state.research.activeStartedAt = now;
  state.research.activeDurationMs = durationMs;
  state.research.activeEndsAt = now + durationMs;
  state.research.completed[entry.id] = {
    id: entry.id,
    startedAt: now,
    completedAt: null,
    durationMs,
    name: entry.name
  };

  addLog(`${entry.name} started. Estimated completion: ${formatDuration(durationMs)}.`);
  renderTopbar();
  if (typeof navigate === 'function') navigate(state.ui.currentPage);
  saveGame();
}

function completeResearch(entry, completedAt = Date.now()) {
  if (!entry) return false;
  const record = state.research.completed[entry.id] || {
    id: entry.id,
    startedAt: state.research.activeStartedAt || completedAt,
    durationMs: state.research.activeDurationMs || getResearchDurationMs(entry),
    name: entry.name
  };
  record.completedAt = completedAt;
  record.durationMs = record.durationMs || state.research.activeDurationMs || getResearchDurationMs(entry);
  record.name = entry.name;
  state.research.completed[entry.id] = record;
  state.research.levels[entry.key] = Math.max(state.research.levels[entry.key] || 0, entry.level);
  state.research.activeId = null;
  state.research.activeStartedAt = 0;
  state.research.activeEndsAt = 0;
  state.research.activeDurationMs = 0;

  const unlocks = typeof getResearchUnlocks === "function" ? getResearchUnlocks(entry) : [];
  addLog(`${entry.name} completed.`);
  if (unlocks.length > 0) {
    addLog(`New research routes opened: ${unlocks.map(item => item.name).join(", ")}.`);
  }
  gainXp(20, `Research • ${entry.name}`);
  saveGame();
  return true;
}

function updateResearchProgress(now = Date.now()) {
  const entry = typeof getActiveResearchEntry === "function" ? getActiveResearchEntry() : null;
  if (!entry) {
    if (state.research.activeId) {
      state.research.activeId = null;
      state.research.activeStartedAt = 0;
      state.research.activeEndsAt = 0;
      state.research.activeDurationMs = 0;
    }
    return false;
  }

  if ((state.research.levels?.[entry.key] || 0) >= entry.level) {
    state.research.activeId = null;
    state.research.activeStartedAt = 0;
    state.research.activeEndsAt = 0;
    state.research.activeDurationMs = 0;
    return false;
  }

  if (!state.research.activeStartedAt || !state.research.activeEndsAt || !state.research.activeDurationMs) {
    const durationMs = typeof getResearchDurationMs === "function" ? getResearchDurationMs(entry) : 0;
    state.research.activeStartedAt = now;
    state.research.activeDurationMs = durationMs;
    state.research.activeEndsAt = now + durationMs;
  }

  if (now >= state.research.activeEndsAt) {
    return completeResearch(entry, now);
  }

  return false;
}

function buyItem() {
  if (state.player.credits < 150000) {
    addLog("Not enough credits.");
    return;
  }

  state.player.credits -= 150000;
  addLog("Purchased: Plasma Cannon.");
  renderTopbar();
  saveGame();
}
