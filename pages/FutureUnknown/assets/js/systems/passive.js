function applyVitalWarnings() {
  const flags = state.meta.warningFlags;
  const p = state.player;

  if (p.mood <= 15 && !flags.moodCritical) {
    addLog("Warning: Mood critical.");
    flags.moodCritical = true;
  } else if (p.mood > 15) {
    flags.moodCritical = false;
  }

  if (p.mood <= 30 && !flags.moodLow) {
    addLog("Warning: Mood low.");
    flags.moodLow = true;
  } else if (p.mood > 30) {
    flags.moodLow = false;
  }

  if (p.nutrition <= 15 && !flags.nutritionCritical) {
    addLog("Warning: Nutrition critical.");
    flags.nutritionCritical = true;
  } else if (p.nutrition > 15) {
    flags.nutritionCritical = false;
  }

  if (p.nutrition <= 30 && !flags.nutritionLow) {
    addLog("Warning: Nutrition low.");
    flags.nutritionLow = true;
  } else if (p.nutrition > 30) {
    flags.nutritionLow = false;
  }

  const food = getFoodSupplySummary();
  if (food.stock === 0 && !flags.foodEmpty) {
    addLog("Warning: Food stores depleted.");
    flags.foodEmpty = true;
  } else if (food.stock > 0) {
    flags.foodEmpty = false;
  }

  if (food.stock > 0 && food.stock <= Math.max(5, Math.floor(food.cap * 0.05)) && !flags.foodLow) {
    addLog("Warning: Food stores low.");
    flags.foodLow = true;
  } else if (food.stock > Math.max(5, Math.floor(food.cap * 0.05))) {
    flags.foodLow = false;
  }
}

function runPassiveSystems(deltaMs = 5000, options = {}) {
  const { skipRender = false, skipSave = false } = options;
  const p = state.player;
  const cfg = getPassiveSettings();

  p.energy = clamp(
    p.energy + (ratePerMs(cfg.energyRecoveryPer5Min, 5 * 60 * 1000) * deltaMs),
    0,
    p.energyMax
  );

  p.health = clamp(
    p.health + (ratePerMs(cfg.healthRecoveryPer5Min, 5 * 60 * 1000) * deltaMs),
    0,
    p.healthMax
  );

  p.stamina = clamp(
    p.stamina + (ratePerMs(cfg.staminaRecoveryPer5Min, 5 * 60 * 1000) * deltaMs),
    0,
    p.staminaMax
  );

  p.mood = clamp(
    p.mood - (ratePerMs(cfg.moodDecayPer24h, 24 * 60 * 60 * 1000) * deltaMs),
    0,
    p.moodMax
  );

  p.nutrition = clamp(
    p.nutrition - (ratePerMs(cfg.nutritionDecayPerHour, 60 * 60 * 1000) * deltaMs),
    0,
    p.nutritionMax
  );

  p.fitness = clamp(
    p.fitness - (ratePerMs(cfg.fitnessDecayPer2h, 2 * 60 * 60 * 1000) * deltaMs),
    0,
    p.fitnessMax
  );

  if (!state.events.active || state.events.active.type !== 'interception') {
    const shieldRate = state.travel.active ? 1.2 : 2.5;
    state.ship.shield = clamp(state.ship.shield + (shieldRate * (deltaMs / 5000)), 0, state.ship.shieldMax);
  }

  if (p.nutrition === 0) {
    p.health = clamp(p.health - (ratePerMs(5, 60 * 60 * 1000) * deltaMs), 0, p.healthMax);
  }

  restockMarket();

  p.energy = Math.round(p.energy * 10) / 10;
  p.health = Math.round(p.health * 10) / 10;
  p.stamina = Math.round(p.stamina * 10) / 10;
  p.mood = Math.round(p.mood * 10) / 10;
  p.nutrition = Math.round(p.nutrition * 10) / 10;
  p.fitness = Math.round(p.fitness * 10) / 10;
  state.ship.shield = Math.round(state.ship.shield * 10) / 10;

  updateMarketPassive(deltaMs);
  const researchCompleted = typeof updateResearchProgress === 'function' ? updateResearchProgress() : false;
  applyVitalWarnings();

  if (!skipRender) {
    renderTopbar();
    if (state.ui.currentPage === 'research' && typeof renderResearch === 'function') {
      renderResearch();
    }
    // Most pages stay stable on passive ticks. Research is redrawn so its live timer can move.
  }

  if (researchCompleted && skipRender && typeof renderTopbar === 'function') {
    renderTopbar();
  }

  if (!skipSave || researchCompleted) {
    saveGame();
  }
}

function applyOfflineProgress() {
  const savedAt = state.meta && state.meta.lastSavedAt ? state.meta.lastSavedAt : 0;
  if (!savedAt) return;

  const now = Date.now();
  let offlineMs = now - savedAt;
  if (offlineMs <= 0) return;

  const cappedOfflineMs = Math.min(offlineMs, 60 * 60 * 1000);

  syncTravelState(now, true);
  runPassiveSystems(cappedOfflineMs, { skipRender: true, skipSave: true });

  if (cappedOfflineMs >= 1000) {
    addLog(`Offline progress applied: ${formatDuration(cappedOfflineMs)}.`);
  }
}
