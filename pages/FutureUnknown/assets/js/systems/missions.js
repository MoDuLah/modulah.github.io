
function missionRewardText(reward) {
  const bits = [];
  if (reward.credits) bits.push(`${reward.credits.toLocaleString()} credits`);
  if (reward.xp) bits.push(`${reward.xp} XP`);
  return bits.join(' • ');
}

function getMissionTargetCount(type) {
  return 1;
}

function createMission(type) {
  const planets = currentSystemData().planets || [];
  const discovered = planets.filter(p => p.discovered);
  const travelOptions = discovered.filter(p => p.name !== state.map.currentPlanet);
  const templates = {
    scan: () => ({
      id: uid('mission'),
      type: 'scan',
      title: 'Deep Scan Contract',
      description: `Resolve one unknown signal in ${state.map.currentSystem}.`,
      targetCount: 1,
      currentCount: 0,
      status: 'available',
      reward: { credits: 2200, xp: 20 }
    }),
    salvage: () => ({
      id: uid('mission'),
      type: 'salvage',
      title: 'Recovery Sweep',
      description: `Strip one debris field in ${state.map.currentSystem} and secure all recoverable salvage.`,
      targetCount: 1,
      currentCount: 0,
      status: 'available',
      reward: { credits: 2600, xp: 24 }
    }),
    delivery: () => ({
      id: uid('mission'),
      type: 'delivery',
      title: 'Freight Liaison',
      description: 'Receive one remote cargo delivery from another planet.',
      targetCount: 1,
      currentCount: 0,
      status: 'available',
      reward: { credits: 2400, xp: 22 }
    }),
    travel: () => {
      const destination = travelOptions[Math.floor(Math.random() * travelOptions.length)] || null;
      return {
        id: uid('mission'),
        type: 'travel',
        title: 'Route Validation',
        description: destination
          ? `Travel to ${destination.name} and confirm the lane is stable.`
          : 'Travel to any off-world destination and confirm the lane is stable.',
        targetPlanet: destination ? destination.name : null,
        targetCount: 1,
        currentCount: 0,
        status: 'available',
        reward: { credits: 1800, xp: 16 }
      };
    }
  };
  return templates[type]();
}

function chooseMissionTypes() {
  const system = currentSystemData();
  const types = [];
  const hasUnknown = system.planets.some(p => !p.discovered);
  const hasDebris = system.debrisFields.some(d => !d.salvaged);
  const hasTravelTarget = system.planets.some(p => p.discovered && p.name !== state.map.currentPlanet);

  if (hasUnknown) types.push('scan');
  if (hasDebris) types.push('salvage');
  types.push('delivery');
  if (hasTravelTarget) types.push('travel');

  const repeatable = hasTravelTarget ? ['delivery', 'travel'] : ['delivery'];
  let repeatIndex = 0;
  while (types.length < 3) {
    types.push(repeatable[repeatIndex % repeatable.length]);
    repeatIndex += 1;
  }
  return types.slice(0, 3);
}

function ensureMissionBoard(force = false) {
  const now = Date.now();
  if (!force && state.missions.board.length > 0 && (!state.missions.nextRefreshAt || now < state.missions.nextRefreshAt)) {
    return;
  }

  const active = getActiveMission();
  const activeMissionId = active ? active.id : null;
  const types = chooseMissionTypes();
  const board = types.map(createMission);

  if (active) {
    const activeClone = JSON.parse(JSON.stringify(active));
    activeClone.status = 'active';
    board[0] = activeClone;
  }

  state.missions.board = board;
  state.missions.activeMissionId = activeMissionId;
  state.missions.nextRefreshAt = now + (20 * 60 * 1000);
}

function getMissionById(missionId) {
  return state.missions.board.find(m => m.id === missionId) || null;
}

function getActiveMission() {
  return state.missions.board.find(m => m.status === 'active') || null;
}

function acceptMission(missionId) {
  ensureMissionBoard();
  const mission = getMissionById(missionId);
  if (!mission) {
    addLog('Mission contract not found.');
    return;
  }
  const active = getActiveMission();
  if (active && active.id !== mission.id) {
    addLog('You already have an active mission. Complete or abandon it first.');
    return;
  }
  mission.status = 'active';
  mission.currentCount = mission.currentCount || 0;
  state.missions.activeMissionId = mission.id;
  addLog(`Mission accepted: ${mission.title}.`);
  renderTopbar();
  navigate('missions');
  saveGame();
}

function abandonMission() {
  const active = getActiveMission();
  if (!active) {
    addLog('No active mission to abandon.');
    return;
  }
  active.status = 'available';
  active.currentCount = 0;
  state.missions.activeMissionId = null;
  addLog(`Mission abandoned: ${active.title}.`);
  navigate('missions');
  saveGame();
}

function completeMission(mission) {
  mission.status = 'completed';
  state.missions.activeMissionId = null;
  state.missions.stats.completed += 1;
  state.missions.completed.unshift({
    id: mission.id,
    title: mission.title,
    completedAt: Date.now(),
    reward: JSON.parse(JSON.stringify(mission.reward || {}))
  });
  state.missions.completed = state.missions.completed.slice(0, 12);

  if (mission.reward && mission.reward.credits) {
    state.player.credits += mission.reward.credits;
  }
  if (mission.reward && mission.reward.xp) {
    gainXp(mission.reward.xp, `Mission completed: ${mission.title}`);
  }

  addLog(`Mission complete: ${mission.title}. Reward issued: ${missionRewardText(mission.reward)}.`);
  state.missions.nextRefreshAt = 0;
  ensureMissionBoard(true);
  saveGame();
}

function updateMissionProgress(eventType, payload = {}) {
  const mission = getActiveMission();
  if (!mission) return;

  let matched = false;
  if (mission.type === 'scan' && eventType === 'scan_discovery') matched = true;
  if (mission.type === 'salvage' && eventType === 'salvage_complete') matched = true;
  if (mission.type === 'delivery' && eventType === 'delivery_received' && payload.fromPlanet && payload.fromPlanet !== state.map.currentPlanet) matched = true;
  if (mission.type === 'travel' && eventType === 'travel_arrival') {
    matched = !mission.targetPlanet || mission.targetPlanet === payload.planetName;
  }

  if (!matched) return;

  mission.currentCount = Math.min(mission.targetCount || 1, (mission.currentCount || 0) + 1);
  addLog(`Mission progress: ${mission.title} (${mission.currentCount}/${mission.targetCount}).`);

  if (mission.currentCount >= (mission.targetCount || 1)) {
    completeMission(mission);
  } else {
    saveGame();
  }
}
