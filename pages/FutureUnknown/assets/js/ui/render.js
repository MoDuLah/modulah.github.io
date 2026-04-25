function setActiveNav(page) {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.page === page);
  });
}

function getThresholdClass(value, max, positive = true) {
  const ratio = max > 0 ? (value / max) : 0;
  if (!positive) return ratio >= 0.7 ? 'badge-bad' : ratio >= 0.4 ? 'badge-warn' : 'badge-good';
  return ratio >= 0.6 ? 'badge-good' : ratio >= 0.3 ? 'badge-warn' : 'badge-bad';
}

function renderSidebarStats() {
  const p = state.player;
  const s = state.ship;
  const container = document.getElementById("sidebar-stats");
  if (!container) return;
  container.innerHTML = `
    <div class="stat-chip sidebar-chip">
      <div class="stat-label">Commander</div>
      <div class="stat-line"><span class="stat-value">${p.name || "Unassigned"}</span><span class="stat-note">Level ${p.level}</span></div>
      <div class="stat-line"><span class="stat-note">${(typeof FACTIONS!=="undefined" && p.faction && FACTIONS[p.faction]) ? FACTIONS[p.faction].name : (p.tribe ? p.tribe.charAt(0).toUpperCase() + p.tribe.slice(1) : "No faction")}</span><span class="stat-note">${Math.floor(p.xp)}/${p.xpToNext} XP</span></div>
      <div class="micro-bar"><div class="micro-bar-fill bar-xp" style="width:${getXpPercent()}%"></div></div>
    </div>

    <div class="stat-chip sidebar-chip">
      <div class="stat-label">Vitals</div>
      <div class="stat-line"><span>Energy</span><span class="stat-value">${Math.floor(p.energy)}/${p.energyMax}</span></div>
      <div class="micro-bar"><div class="micro-bar-fill bar-energy" style="width:${pct(p.energy, p.energyMax)}%"></div></div>
      <div class="stat-line" style="margin-top:8px;"><span>Health</span><span class="stat-value">${Math.floor(p.health)}/${p.healthMax}</span></div>
      <div class="micro-bar"><div class="micro-bar-fill bar-health" style="width:${pct(p.health, p.healthMax)}%"></div></div>
      <div class="stat-line" style="margin-top:8px;"><span>Stamina</span><span class="stat-value">${Math.floor(p.stamina)}/${p.staminaMax}</span></div>
      <div class="micro-bar"><div class="micro-bar-fill bar-shield" style="width:${pct(p.stamina, p.staminaMax)}%"></div></div>
      <div class="stat-line" style="margin-top:8px;"><span>Mood</span><span class="stat-value">${Math.floor(p.mood)}/${p.moodMax}</span></div>
      <div class="micro-bar"><div class="micro-bar-fill bar-${pct(p.mood,p.moodMax)>=60?'health':pct(p.mood,p.moodMax)>=30?'xp':'bad'}" style="width:${pct(p.mood, p.moodMax)}%"></div></div>
      <div class="stat-line" style="margin-top:8px;"><span>Nutrition</span><span class="stat-value">${Math.floor(p.nutrition)}/${p.nutritionMax}</span></div>
      <div class="micro-bar"><div class="micro-bar-fill bar-${pct(p.nutrition,p.nutritionMax)>=60?'health':pct(p.nutrition,p.nutritionMax)>=30?'xp':'bad'}" style="width:${pct(p.nutrition, p.nutritionMax)}%"></div></div>
      <div class="stat-line" style="margin-top:8px;"><span>Fitness</span><span class="stat-value">${Math.floor(p.fitness)}/${p.fitnessMax}</span></div>
      <div class="micro-bar"><div class="micro-bar-fill bar-${pct(p.fitness,p.fitnessMax)>=60?'health':pct(p.fitness,p.fitnessMax)>=30?'xp':'bad'}" style="width:${pct(p.fitness, p.fitnessMax)}%"></div></div>
    </div>

    <div class="stat-chip sidebar-chip">
      <div class="stat-label">Ship Core</div>
      <div class="stat-line"><span>Hull</span><span class="stat-value">${Math.floor(s.hull)}/${s.hullMax}</span></div>
      <div class="micro-bar"><div class="micro-bar-fill bar-health" style="width:${pct(s.hull, s.hullMax)}%"></div></div>
      <div class="stat-line" style="margin-top:8px;"><span>Shield</span><span class="stat-value">${Math.floor(s.shield)}/${s.shieldMax}</span></div>
      <div class="micro-bar"><div class="micro-bar-fill bar-shield" style="width:${pct(s.shield, s.shieldMax)}%"></div></div>
      <div class="stat-line" style="margin-top:8px;"><span>Credits</span><span class="stat-value">${p.credits.toLocaleString()}</span></div>
    </div>
  `;

  const statusValue = document.querySelector('.sidebar-status-value');
  if (statusValue) statusValue.textContent = `${state.map.currentSystem.toUpperCase()} / ${state.travel.active ? 'IN TRANSIT' : 'STABLE'}`;
}

function renderTopbar() {
  const travelStatus = state.travel.active
    ? `${state.travel.mode === 'system' ? 'System Jump' : 'Travelling'} • ${state.travel.toPlanet}`
    : state.events.active
      ? 'Event Active'
      : 'Docked';

  document.getElementById("topbar").innerHTML = `
    <div class="topbar-strip">
      <div>
        <div class="stat-label">Current View</div>
        <div class="topbar-title">${state.player.created ? (state.player.name || 'Commander') + ' • ' : ''}${(state.ui.currentPage || 'dashboard').replace(/^./, c => c.toUpperCase())}</div>
      </div>
      <div class="topbar-meta">
        <span class="badge badge-info">${getLocationText()}</span>
        <span class="badge ${state.travel.active ? 'badge-warn' : state.events.active ? 'badge-bad' : 'badge-good'}">${travelStatus}</span>
      </div>
    </div>
  `;
  renderSidebarStats();
}

function navigate(page) {
  if (!state.player.created && page !== 'settings' && page !== 'character') {
    renderCharacterCreation();
    return;
  }

  state.ui.currentPage = page;
  setActiveNav(page);

  if (page === "dashboard") return renderDashboard();
  if (page === "map") return renderMap();
  if (page === "planet") {
    if (state.ui.selectedPlanetName) return selectPlanet(state.ui.selectedPlanetName);
    return renderMap();
  }
  if (page === "debris") {
    if (state.map.selectedDebrisId) return viewDebris(state.map.selectedDebrisId);
    return renderMap();
  }
  if (page === "ship") return renderShip();
  if (page === "missions") return renderMissions();
  if (page === "research") return renderResearch();
  if (page === "market") return renderMarket();
  if (page === "settings") return renderSettings();
  if (page === "character") return renderCharacterCreation();

  return renderDashboard();
}

function renderDashboard() {
  state.ui.currentPage = "dashboard";
  state.ui.selectedPlanetName = null;
  state.map.selectedDebrisId = null;
  const system = currentSystemData();
  const discoveredCount = system.planets.filter(p => p.discovered).length;
  const totalCount = system.planets.length;
  const unknownCount = totalCount - discoveredCount;
  const debrisCount = system.debrisFields.length;
  const damagedCount = state.inventory.damagedComponents.length;
  const repairedCount = state.inventory.repairedComponents.length;

  const materialsHtml = Object.entries(state.inventory.materials).map(([key, value]) => {
    const meta = materialMeta(key);
    return `
      <div class="material-item">
        <div class="material-left">
          <div class="material-icon ${meta.className}"></div>
          <div>
            <div>${meta.label}</div>
            <div class="subtle">Recovered / ready for fabrication</div>
          </div>
        </div>
        <div class="metric-value" style="font-size:20px;">${value}</div>
      </div>
    `;
  }).join("");

  document.getElementById("main").innerHTML = `
    <div class="page-title">Command Dashboard</div>
    <div class="page-subtitle">Core systems are online. Crew recovery, shield regeneration, travel routing, scanning, and salvage are all feeding into the same tactical interface now.</div>

    <div class="grid-two">
      <div>
        <div class="panel hero-panel">
          <div class="panel-header">Mission Control</div>
          <div class="kv">Welcome back, Commander. Solaris traffic lanes are stable and passive ship systems are operating normally.</div>
          <div class="metric-grid">
            <div class="metric-card">
              <div class="metric-label">Survey Progress</div>
              <div class="metric-value">${discoveredCount}/${totalCount}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Unknown Signals</div>
              <div class="metric-value">${unknownCount}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Debris Fields</div>
              <div class="metric-value">${debrisCount}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Components Restored</div>
              <div class="metric-value">${repairedCount}</div>
            </div>
          </div>
          <div style="margin-top:14px" class="row">
            <button class="btn" onclick="feedPlayer()">Feed Crew</button>
            <button class="btn" onclick="exercisePlayer()">Exercise</button>
            <button class="btn btn-primary" onclick="navigate('map')">Open Star Map</button>
          </div>
        </div>

        ${renderTravelPanel()}
        ${renderEventPanel()}
      </div>

      <div>
        <div class="panel">
          <div class="panel-header">Resource Inventory</div>
          <div class="material-list">${materialsHtml}</div>
        </div>

        <div class="panel">
          <div class="panel-header">Operational Readiness</div>
          <div class="row">
            <span class="badge ${state.player.nutrition >= 60 ? 'badge-good' : state.player.nutrition >= 30 ? 'badge-warn' : 'badge-bad'}">Nutrition ${Math.floor(state.player.nutrition)}</span>
            <span class="badge ${state.player.fitness >= 60 ? 'badge-good' : state.player.fitness >= 30 ? 'badge-warn' : 'badge-bad'}">Fitness ${Math.floor(state.player.fitness)}</span>
            <span class="badge ${state.player.mood >= 60 ? 'badge-good' : state.player.mood >= 30 ? 'badge-warn' : 'badge-bad'}">Mood ${Math.floor(state.player.mood)}</span>
            <span class="badge badge-info">Damage Queue ${damagedCount}</span>
          </div>
          <div class="panel-illustration" style="margin-top:14px;"></div>
        </div>
      </div>
    </div>
  `;
}

function renderShip() {
  state.ui.currentPage = "ship";
  state.ui.selectedPlanetName = null;
  state.map.selectedDebrisId = null;
  const s = state.ship;

  document.getElementById("main").innerHTML = `
    <div class="page-title">Ship Systems</div>
    <div class="page-subtitle">A first-pass FU ship page with visual framing, status emphasis, and room for equipment, weapons, cargo, and module slots later.</div>

    ${renderTravelPanel()}
    ${renderEventPanel()}

    <div class="panel">
      <div class="panel-header">Vanguard Frame</div>
      <div class="ship-hero">
        <div class="ship-illustration"></div>
        <div>
          <div class="kv">Hull Integrity</div>
          <div class="progress"><div class="progress-fill bar-health" style="width:${pct(s.hull, s.hullMax)}%"></div></div>

          <br>

          <div class="kv">Shield Capacity</div>
          <div class="progress"><div class="progress-fill bar-shield" style="width:${pct(s.shield, s.shieldMax)}%"></div></div>

          <br>

          <div class="row">
            <span class="badge">Laser</span>
            <span class="badge">Ion</span>
            <span class="badge ${state.events.active && state.events.active.type === 'interception' ? 'badge-bad' : 'badge-good'}">
              ${state.events.active && state.events.active.type === 'interception' ? 'Contact Detected' : 'Comms Stable'}
            </span>
          </div>

          <div style="margin-top:14px;">
            <button class="btn btn-primary" onclick="repairShip()">Repair Ship</button>
          </div>
          <div class="subtle" style="margin-top:8px;">Shields recharge automatically over time when not under active interception. Hull repairs still need dockyard work or resource-based mechanics later.</div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">Recovered Components</div>
      ${
        state.inventory.repairedComponents.length === 0
          ? `<div class="subtle">No repaired components yet.</div>`
          : `<div class="component-list">${
              state.inventory.repairedComponents.map((c, i) => `
                <div class="component-item">
                  <div class="component-left">
                    <div class="material-icon material-circuit"></div>
                    <div>
                      <div>${i + 1}. ${c.name}</div>
                      <div class="subtle">Refurbished and ready for future fitting slots</div>
                    </div>
                  </div>
                  <span class="badge badge-good">${c.quality}</span>
                </div>
              `).join("")
            }</div>`
      }
    </div>
  `;
}

function renderMissions() {
  state.ui.currentPage = "missions";
  state.ui.selectedPlanetName = null;
  state.map.selectedDebrisId = null;
  if (typeof ensureMissionBoard === "function") ensureMissionBoard();
  const active = typeof getActiveMission === "function" ? getActiveMission() : null;
  const board = state.missions?.board || [];
  const missionCards = board.length === 0
    ? `<div class="subtle">No contracts are currently available.</div>`
    : board.map(mission => {
        const current = mission.currentCount || 0;
        const target = mission.targetCount || 1;
        const progress = Math.floor((current / target) * 100);
        const isActive = active && active.id === mission.id;
        const statusClass = isActive ? "badge-info" : mission.status === "completed" ? "badge-good" : "badge-warn";
        const reward = typeof missionRewardText === "function" ? missionRewardText(mission.reward || {}) : "";
        const action = isActive
          ? `<button class="btn" onclick="abandonMission()">Abandon Contract</button>`
          : `<button class="btn btn-primary" onclick="acceptMission('${mission.id}')" ${active ? "disabled" : ""}>Accept Contract</button>`;

        return `
          <div class="panel">
            <div class="panel-header">${mission.title}</div>
            <div class="row" style="margin-bottom:10px;">
              <span class="badge ${statusClass}">${isActive ? "Active" : "Available"}</span>
              <span class="badge badge-info">${mission.type.replace(/^./, c => c.toUpperCase())}</span>
            </div>
            <div class="kv">${mission.description}</div>
            ${mission.targetPlanet ? `<div class="kv">Target: ${mission.targetPlanet}</div>` : ""}
            <div class="kv">Progress: ${current}/${target}</div>
            <div class="travel-progress"><div class="travel-progress-fill" style="width:${progress}%"></div></div>
            <div class="kv" style="margin-top:10px;">Reward: ${reward || "Field recognition"}</div>
            <div class="row" style="margin-top:12px;">${action}</div>
          </div>
        `;
      }).join("");
  const completedHtml = state.missions.completed.length === 0
    ? `<div class="subtle">No completed contracts yet.</div>`
    : state.missions.completed.map(mission => `
        <div class="component-item">
          <div>
            <div>${mission.title}</div>
            <div class="subtle">Reward: ${typeof missionRewardText === "function" ? missionRewardText(mission.reward || {}) : ""}</div>
          </div>
          <span class="badge badge-good">Complete</span>
        </div>
      `).join("");

  document.getElementById("main").innerHTML = `
    <div class="page-title">Mission Board</div>
    <div class="page-subtitle">Local contracts reward scans, salvage, freight deliveries, and route validation. Keep one active contract at a time.</div>

    ${renderTravelPanel()}
    ${renderEventPanel()}

    <div class="grid-two">
      <div>
        ${missionCards}
      </div>
      <div>
        <div class="panel">
          <div class="panel-header">Contract Record</div>
          <div class="kv">Completed: ${state.missions.stats.completed}</div>
          <div class="kv">Next Refresh: ${formatDuration(Math.max(0, (state.missions.nextRefreshAt || 0) - Date.now()))}</div>
          <div class="row" style="margin-top:12px;">
            <button class="btn" onclick="ensureMissionBoard(true); renderMissions(); saveGame();">Refresh Board</button>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">Completed Contracts</div>
          <div class="component-list">${completedHtml}</div>
        </div>
      </div>
    </div>
  `;
}

function selectResearchEntry(researchId) {
  if (typeof getResearchEntry !== "function") return;
  const entry = getResearchEntry(researchId);
  if (!entry) return;
  state.ui.selectedResearchId = researchId;
  renderResearch();
  saveGame();
}

function getResearchStatusMeta(status) {
  const map = {
    completed: { label: "Completed", className: "badge-good" },
    active: { label: "Active", className: "badge-info" },
    available: { label: "Ready", className: "badge-good" },
    busy: { label: "Lab Busy", className: "badge-info" },
    blocked: { label: "Need Materials", className: "badge-warn" },
    locked: { label: "Locked", className: "badge-bad" },
    unknown: { label: "Unavailable", className: "badge-bad" }
  };
  return map[status] || map.unknown;
}

function getDefaultResearchSelection(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  if (state.ui.selectedResearchId && entries.some(entry => entry.id === state.ui.selectedResearchId)) {
    return state.ui.selectedResearchId;
  }

  const preferredStatuses = ["available", "blocked", "locked", "completed"];
  for (const status of preferredStatuses) {
    const match = entries.find(entry => getResearchStatus(entry) === status);
    if (match) return match.id;
  }

  return entries[0].id;
}

function renderResearchNode(entry, selectedId) {
  const status = typeof getResearchStatus === "function" ? getResearchStatus(entry) : "unknown";
  const meta = getResearchStatusMeta(status);
  const requirements = typeof getResearchRequirementLabels === "function" ? getResearchRequirementLabels(entry).slice(1) : [];
  const unlockCount = typeof getResearchUnlocks === "function" ? getResearchUnlocks(entry).length : 0;
  const currentLevel = typeof getResearchLevel === "function" ? getResearchLevel(entry.key) : 0;
  const durationMs = typeof getResearchDurationMs === "function" ? getResearchDurationMs(entry) : 0;
  const progress = typeof getResearchProgressPercent === "function" ? getResearchProgressPercent(entry) : 0;
  const remainingMs = typeof getResearchRemainingMs === "function" ? getResearchRemainingMs(entry) : 0;
  const progressHtml = status === "active" || status === "completed"
    ? `
      <div class="research-progress">
        <div class="research-progress-fill" style="width:${progress}%"></div>
      </div>
      <div class="research-node-line">${status === "active" ? `Remaining: ${formatDuration(remainingMs)}` : "Progress: Complete"}</div>
    `
    : "";

  return `
    <button
      type="button"
      class="research-node is-${status}${selectedId === entry.id ? " is-selected" : ""}"
      onclick="selectResearchEntry('${entry.id}')"
    >
      <div class="research-node-header">
        <div>
          <div class="research-node-meta">${entry.category} • Tier ${entry.tier}</div>
          <div class="research-node-title">${entry.name}</div>
        </div>
        <span class="badge ${meta.className}">${meta.label}</span>
      </div>
      <div class="subtle">${entry.description}</div>
      <div class="research-node-line">Track Level: ${currentLevel}/${entry.level}</div>
      <div class="research-node-line">Time Needed: ${formatDuration(durationMs)}</div>
      <div class="research-node-line">${requirements.length > 0 ? `Requires: ${requirements.join(", ")}` : "Requires: Research Lab access"}</div>
      <div class="research-node-line">Unlocks: ${unlockCount > 0 ? `${unlockCount} follow-up node${unlockCount !== 1 ? "s" : ""}` : "Final node in branch"}</div>
      ${progressHtml}
    </button>
  `;
}

function renderResearch() {
  state.ui.currentPage = "research";
  state.ui.selectedPlanetName = null;
  state.map.selectedDebrisId = null;
  const entries = typeof getResearchEntries === "function" ? getResearchEntries() : [];
  const selectedId = getDefaultResearchSelection(entries);
  state.ui.selectedResearchId = selectedId;
  const entry = selectedId && typeof getResearchEntry === "function" ? getResearchEntry(selectedId) : null;
  const status = entry && typeof getResearchStatus === "function" ? getResearchStatus(entry) : "unknown";
  const statusMeta = getResearchStatusMeta(status);
  const activeEntry = typeof getActiveResearchEntry === "function" ? getActiveResearchEntry() : null;
  const selectedDurationMs = entry && typeof getResearchDurationMs === "function" ? getResearchDurationMs(entry) : 0;
  const selectedProgress = entry && typeof getResearchProgressPercent === "function" ? getResearchProgressPercent(entry) : 0;
  const selectedRemainingMs = entry && typeof getResearchRemainingMs === "function" ? getResearchRemainingMs(entry) : 0;
  const activeRemainingMs = activeEntry && typeof getResearchRemainingMs === "function" ? getResearchRemainingMs(activeEntry) : 0;
  const inv = state.inventory?.materials || {};
  const inventoryCards = Object.entries(inv).map(([key, value]) => {
    const meta = materialMeta(key);
    return `
      <div class="material-item">
        <div class="material-left">
          <div class="material-icon ${meta.className}"></div>
          <div>
            <div>${meta.label}</div>
            <div class="subtle">Research reserve</div>
          </div>
        </div>
        <div class="metric-value" style="font-size:20px;">${value}</div>
      </div>
    `;
  }).join("") || `<div class="subtle">No materials in storage.</div>`;
  const costText = entry && typeof formatResearchCost === "function" ? formatResearchCost(entry) : "Unavailable";
  const completedCount = entries.filter(item => getResearchStatus(item) === "completed").length;
  const availableCount = entries.filter(item => getResearchStatus(item) === "available").length;
  const blockedCount = entries.filter(item => getResearchStatus(item) === "blocked").length;
  const requirements = entry && typeof getResearchRequirementLabels === "function" ? getResearchRequirementLabels(entry) : [];
  const unlocks = entry && typeof getResearchUnlocks === "function" ? getResearchUnlocks(entry) : [];
  const tierGroups = entries.reduce((groups, item) => {
    if (!groups[item.tier]) groups[item.tier] = [];
    groups[item.tier].push(item);
    return groups;
  }, {});
  const requirementsHtml = requirements.length === 0
    ? `<div class="subtle">No requirements recorded.</div>`
    : `<ul class="research-list">${requirements.map(item => `<li>${item}</li>`).join("")}</ul>`;
  const effectsHtml = entry && entry.effects && entry.effects.length > 0
    ? `<ul class="research-list">${entry.effects.map(item => `<li>${item}</li>`).join("")}</ul>`
    : `<div class="subtle">No direct effects listed.</div>`;
  const unlocksHtml = unlocks.length > 0
    ? `<ul class="research-list">${unlocks.map(item => `<li>${item.name}</li>`).join("")}</ul>`
    : `<div class="subtle">This node currently caps its branch.</div>`;
  const actionLabel = status === "completed"
    ? "Completed"
    : status === "active"
      ? "In Progress"
      : status === "busy"
        ? "Lab Busy"
        : status === "locked"
          ? "Locked"
          : status === "blocked"
            ? "Need Materials"
            : "Start Research";
  const detailProgressHtml = entry
    ? `
      <div class="research-progress-block">
        <div class="research-time-row">
          <span>${status === "completed" ? "Complete" : status === "active" ? "In progress" : "Not started"}</span>
          <span>${Math.floor(selectedProgress)}%</span>
        </div>
        <div class="research-progress">
          <div class="research-progress-fill" style="width:${selectedProgress}%"></div>
        </div>
        <div class="research-time-row">
          <span>Time Needed: ${formatDuration(selectedDurationMs)}</span>
          <span>${status === "active" ? `Remaining: ${formatDuration(selectedRemainingMs)}` : ""}</span>
        </div>
      </div>
    `
    : "";

  document.getElementById("main").innerHTML = `
    <div class="page-title">Research Tree</div>
    <div class="page-subtitle">Research now unfolds as a dependency tree. Advance foundational systems first, then branch into navigation, commerce, engineering, exploration, and defense.</div>

    ${renderTravelPanel()}
    ${renderEventPanel()}

    <div class="panel hero-panel">
      <div class="panel-header">Research Control</div>
      <div class="metric-grid research-summary-grid">
        <div class="metric-card">
          <div class="metric-label">Completed Nodes</div>
          <div class="metric-value">${completedCount}/${entries.length}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Ready Now</div>
          <div class="metric-value">${availableCount}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Blocked by Cost</div>
          <div class="metric-value">${blockedCount}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Active Research</div>
          <div class="metric-value" style="font-size:18px;">${activeEntry ? activeEntry.name : "None"}</div>
          <div class="subtle">${activeEntry ? `ETA ${formatDuration(activeRemainingMs)}` : "Lab standing by"}</div>
        </div>
      </div>
    </div>

    <div class="grid-two research-layout">
      <div class="panel research-tree-panel">
        <div class="panel-header">Research Tree</div>
        <div class="subtle">Select a node to inspect it. Tiered dependencies show which foundational studies feed into later branches.</div>
        ${Object.keys(tierGroups).sort((a, b) => Number(a) - Number(b)).map(tier => `
          <div class="research-tier">
            <div class="research-tier-header">
              <div class="panel-header" style="font-size:15px;">Tier ${tier}</div>
              <div class="subtle">${tierGroups[tier].length} node${tierGroups[tier].length !== 1 ? "s" : ""}</div>
            </div>
            <div class="research-tree-grid">
              ${tierGroups[tier].map(item => renderResearchNode(item, selectedId)).join("")}
            </div>
          </div>
        `).join("")}
      </div>

      <div>
        <div class="panel research-detail-panel">
          <div class="panel-header">${entry ? entry.name : "Research Entry Missing"}</div>
          <div class="row" style="margin-bottom:12px;">
            <span class="badge badge-info">${entry ? entry.category : "Unknown"}</span>
            <span class="badge badge-info">Tier ${entry ? entry.tier : "?"}</span>
            <span class="badge ${statusMeta.className}">${statusMeta.label}</span>
          </div>
          <div class="kv">Cost: ${costText}</div>
          <div class="kv">Time Needed: ${formatDuration(selectedDurationMs)}</div>
          ${status === "active" ? `<div class="kv">Time Remaining: ${formatDuration(selectedRemainingMs)}</div>` : ""}
          <div class="kv">Research Lab Required: Level ${entry?.requires?.labLevel || 1} / ${state.research?.labLevel || 0}</div>
          <div class="kv">Current Track Level: ${entry ? getResearchLevel(entry.key) : 0}</div>
          ${detailProgressHtml}
          <div class="subtle" style="margin-top:10px;">${entry ? entry.description : ""}</div>
          <div class="subtle" style="margin-top:8px;">${entry ? entry.detail : ""}</div>
          <br>
          <div class="panel-header" style="font-size:15px;">Requirements</div>
          ${requirementsHtml}
          <div class="panel-header" style="font-size:15px; margin-top:12px;">Effects</div>
          ${effectsHtml}
          <div class="panel-header" style="font-size:15px; margin-top:12px;">Unlocks</div>
          ${unlocksHtml}
          <br>
          <button class="btn btn-primary" onclick="conductResearch('${entry ? entry.id : ""}')" ${status !== 'available' ? 'disabled' : ''}>${actionLabel}</button>
        </div>

        <div class="panel">
          <div class="panel-header">Material Reserves</div>
          <div class="material-list">${inventoryCards}</div>
        </div>
      </div>
    </div>
  `;
}

function renderMarket() {
  state.ui.currentPage = "market";
  state.ui.selectedPlanetName = null;
  state.map.selectedDebrisId = null;
  const listingsHtml = state.market.listings.map(listing => {
    const etaMs = getMarketDeliveryTimeMs(listing.fromPlanet, state.map.currentPlanet);
    const deliveryText = etaMs === 0
      ? `Immediate collection at ${state.map.currentPlanet}`
      : `Cargo ship from ${listing.fromPlanet} • ETA ${formatDuration(etaMs)}`;

    return `
      <div class="panel">
        <div class="panel-header">${listing.name}</div>
        <div class="kv">Source: ${listing.fromPlanet}</div>
        <div class="kv">Price: ${listing.price.toLocaleString()} credits</div>
        <div class="kv">Stock: ${listing.stock} / ${listing.stockMax || listing.stock || 0}</div>
        <div class="kv">Delivery: ${deliveryText}</div>
        <div class="subtle" style="margin-top:8px;">${listing.description}</div>
        <br>
        <button class="btn btn-primary" onclick="buyMarketListing('${listing.id}')" ${listing.stock <= 0 ? 'disabled' : ''}>${listing.stock <= 0 ? 'Out of Stock' : 'Buy Listing'}</button>
      </div>
    `;
  }).join('');

  const deliveriesHtml = state.market.deliveries.length === 0
    ? `<div class="subtle">No active cargo deliveries. Local purchases are collected instantly and remote orders wait on autonomous freight traffic.</div>`
    : state.market.deliveries.map(delivery => {
        const progress = delivery.totalMs > 0 ? Math.max(0, Math.min(100, ((delivery.totalMs - delivery.remainingMs) / delivery.totalMs) * 100)) : 100;
        return `
          <div class="panel">
            <div class="panel-header">${delivery.listingName}</div>
            <div class="kv">Route: ${delivery.fromPlanet} → ${delivery.toPlanet}</div>
            <div class="kv">ETA: ${formatDuration(delivery.remainingMs)}</div>
            <div class="travel-progress"><div class="travel-progress-fill" style="width:${progress}%"></div></div>
          </div>
        `;
      }).join('');

  document.getElementById("main").innerHTML = `
    <div class="page-title">Market</div>
    <div class="page-subtitle">Auction and freight traffic now run as an actual system. Remote purchases now use full route distance, including cross-system freight, and market stocks rebuild over time.</div>

    ${renderTravelPanel()}
    ${renderEventPanel()}

    <div class="grid-two">
      <div>
        <div class="panel hero-panel">
          <div class="panel-header">${state.map.currentSystem} Exchange</div>
          <div class="kv">Current Dock: ${state.map.currentPlanet}</div>
          <div class="kv">Available Listings: ${state.market.listings.filter(item => item.stock > 0).length}</div>
          <div class="kv">Active Freight: ${state.market.deliveries.length}</div>
          <div class="kv">Food Stores: ${getFoodSupplySummary().stock} / ${getFoodSupplySummary().cap}</div>
          <div class="kv">Next Restock: ${formatDuration(Math.max(0, state.market.restockIntervalMs - (Date.now() - state.market.lastRestockAt)))}</div>
          <div class="subtle" style="margin-top:8px;">Orders from other planets are assigned to cargo ships automatically. The farther the route, the longer the delivery window.</div>
        </div>
        ${listingsHtml}
      </div>
      <div>
        <div class="panel">
          <div class="panel-header">Cargo Deliveries</div>
          ${deliveriesHtml}
        </div>
      </div>
    </div>
  `;
}

function renderTravelPanel() {
  if (!state.travel.active && !state.travel.pendingArrival) {
    return `
      <div class="panel travel-card">
        <div>
          <div class="panel-header" style="margin-bottom:8px;">Travel Link</div>
          <div class="subtle">No active journey. Navigation thrusters are idle and route buffers are clear.</div>
        </div>
        <span class="badge badge-good">Docked</span>
      </div>
    `;
  }

  const percent = state.travel.durationMs > 0
    ? Math.min(100, Math.floor((state.travel.progressMs / state.travel.durationMs) * 100))
    : 0;

  const statusLabel = state.travel.pendingArrival
    ? "Awaiting event resolution"
    : `${state.travel.fromPlanet} → ${state.travel.toPlanet}`;

  return `
    <div class="panel">
      <div class="panel-header">Travel Link</div>
      <div class="kv">${statusLabel}</div>
      <div class="subtle">${state.travel.pendingArrival ? "Transit has paused while the current encounter is resolved." : "Drive coils are engaged and the ship is in transit."}</div>
      <div class="travel-progress">
        <div class="travel-progress-fill" style="width:${percent}%"></div>
      </div>
      <div class="row" style="margin-top:10px;">
        <span class="badge badge-info">Progress ${percent}%</span>
        <span class="badge">${state.travel.toPlanet || "Route Locked"}</span>
      </div>
    </div>
  `;
}

function renderEventPanel() {
  const event = state.events.active;

  if (!event) {
    return `
      <div class="panel event-card">
        <div>
          <div class="panel-header" style="margin-bottom:8px;">Current Event</div>
          <div class="subtle">No active events. Scanner feed is quiet.</div>
        </div>
        <span class="badge badge-good">Clear</span>
      </div>
    `;
  }

  return `
    <div class="panel">
      <div class="panel-header">${event.title}</div>
      <div class="kv">${event.text}</div>
      ${event.detail ? `<div class="subtle">${event.detail}</div>` : ""}
      <br>
      <div class="row">
        ${event.choices.map(choice => `
          <button class="btn ${choice.variant || ''}" onclick="${choice.action}">${choice.label}</button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderMap() {
  state.ui.currentPage = "map";
  state.ui.selectedPlanetName = null;
  state.map.selectedDebrisId = null;
  const system = currentSystemData();
  const unknownCount = system.planets.filter(p => !p.discovered).length;

  let html = `
    <div class="page-title">${state.map.currentSystem} Star Map</div>
    <div class="page-subtitle">This first graphics pass gives the map proper visual identity: planet art, debris art, cleaner navigation cards, and a more game-like tactical page.</div>

    ${renderTravelPanel()}
    ${renderEventPanel()}

    <div class="panel hero-panel">
      <div class="panel-header">System Overview</div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Current Planet</div>
          <div class="metric-value">${state.map.currentPlanet}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Unknown Signals</div>
          <div class="metric-value">${unknownCount}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Debris Fields</div>
          <div class="metric-value">${system.debrisFields.length}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Travel Status</div>
          <div class="metric-value" style="font-size:18px;">${state.travel.active ? "In Transit" : state.events.active ? "Event Active" : "Docked"}</div>
        </div>
      </div>
      <div style="margin-top:14px;" class="row">
        <button class="btn btn-primary" onclick="scanSystem()" ${state.travel.active || state.events.active ? "disabled" : ""}>
          Scan Nearby Space
        </button>
        ${renderSystemJumpControls()}
      </div>
    </div>
  `;

  html += `<div class="star-lane-map">${renderStarLaneMap(system)}</div>`;
  html += `<div class="planet-grid">`;

  system.planets.forEach(p => {
    const planetArg = escapeJsString(p.name);
    if (!p.discovered) {
      html += `
        <div class="panel planet-card">
          <div class="planet-icon planet-unknown"></div>
          <div class="panel-header">Unknown Signal</div>
          <div class="kv">Type: ???</div>
          <div class="kv">Distance: ?</div>
          <div class="kv">Danger: ?</div>
        </div>
      `;
    } else {
      html += `
        <div class="panel planet-card">
          <div class="planet-icon ${planetClass(p.type, p.discovered)}"></div>
          <div class="panel-header">${p.name}</div>
          <div class="kv">Type: ${p.type}</div>
          <div class="kv">Distance: ${p.distance} jump${p.distance !== 1 ? "s" : ""}</div>
          <div class="kv">Danger: ${p.danger}</div>
          <div class="row" style="margin-top:10px;">
            <button class="btn btn-primary" onclick="selectPlanet('${planetArg}')">View</button>
          </div>
        </div>
      `;
    }
  });

  html += `</div>`;
  html += renderDebrisSection(system.debrisFields);

  document.getElementById("main").innerHTML = html;
}


function renderSystemJumpControls() {
  const systems = getSystemNames().filter(name => name !== state.map.currentSystem);
  if (systems.length === 0) return '';
  return systems.map(name => `<button class="btn" onclick="jumpToSystem('${escapeJsString(name)}')" ${state.travel.active || state.events.active ? 'disabled' : ''}>Jump to ${name}</button>`).join('');
}

function renderStarLaneMap(system) {
  const planets = system.planets.filter(p => p.discovered).sort((a, b) => (a.distance || 0) - (b.distance || 0));
  if (planets.length === 0) return '<div class="subtle">No mapped bodies yet.</div>';
  return planets.map((p, index) => `
    <div class="star-node ${p.name === state.map.currentPlanet ? 'is-current' : ''}">
      <div class="star-dot ${planetClass(p.type, true)}"></div>
      <div class="star-label-wrap">
        <div class="star-label">${p.name}</div>
        <div class="subtle">${p.type} • danger ${p.danger}</div>
      </div>
      ${index < planets.length - 1 ? '<div class="star-link"></div>' : ''}
    </div>
  `).join('');
}

function renderDebrisSection(debrisFields) {
  let html = `
    <div class="panel">
      <div class="panel-header">Debris Fields</div>
  `;

  if (debrisFields.length === 0) {
    html += `<div class="subtle">No debris fields currently detected in this system.</div>`;
  } else {
    html += `<div class="debris-grid">`;
    debrisFields.forEach(field => {
      const scannedLabel = field.scanned ? "Scanned" : "Unscanned";
      const salvageLabel = field.salvaged ? `<span class="badge badge-bad">Stripped</span>` : `<span class="badge badge-info">Recoverable</span>`;

      html += `
        <div class="panel debris-card">
          <div class="debris-icon"></div>
          <div class="panel-header">${field.name}</div>
          <div class="kv">Location: ${field.near}</div>
          <div class="kv">Status: ${scannedLabel}</div>
          <div class="kv">Stability: ${field.stability}%</div>
          <div class="kv">Lifetime: ${field.lifetimeHours}h</div>
          <div class="row" style="margin-top:10px;">
            ${salvageLabel}
            <button class="btn btn-primary" onclick="viewDebris('${field.id}')">View</button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function renderDamagedComponents() {
  if (state.inventory.damagedComponents.length === 0) {
    return `<div class="subtle">No damaged components recovered.</div>`;
  }

  return state.inventory.damagedComponents.map(component => {
    const reqs = Object.entries(component.requirements)
      .map(([key, value]) => `${formatComponentName(key)} x${value}`)
      .join(", ");

    return `
      <div class="panel">
        <div class="panel-header">${component.name}</div>
        <div class="kv">Repair Chance: ${component.repairChance}%</div>
        <div class="kv">Requirements: ${reqs}</div>
        <br>
        <button class="btn" onclick="repairDamagedComponent('${component.id}')">Repair</button>
        <button class="btn" onclick="recycleDamagedComponent('${component.id}')">Recycle</button>
      </div>
    `;
  }).join("");
}

function selectPlanet(name) {
  state.ui.currentPage = "planet";
  state.ui.selectedPlanetName = name;
  state.map.selectedDebrisId = null;
  const system = currentSystemData();
  const planet = system.planets.find(p => p.name === name);

  if (!planet) {
    addLog("Planet not found.");
    return;
  }

  const route = getTravelRouteInfo(state.map.currentSystem, state.map.currentPlanet, state.map.currentSystem, planet.name);
  const travelCost = getTravelEnergyCost(route.distance);
  const travelTime = getTravelTimeMs(route.distance);

  document.getElementById("main").innerHTML = `
    ${renderTravelPanel()}
    ${renderEventPanel()}

    <div class="panel">
      <div class="ship-hero">
        <div class="planet-icon ${planetClass(planet.type, planet.discovered)}" style="width:180px;height:180px;"></div>
        <div>
          <div class="page-title" style="font-size:28px;margin-bottom:10px;">${planet.name}</div>
          <div class="kv">Type: ${planet.type}</div>
          <div class="kv">Distance: ${planet.distance} jump${planet.distance !== 1 ? "s" : ""}</div>
          <div class="kv">Danger: ${planet.danger}</div>
          <div class="kv">Energy Cost: ${travelCost}</div>
          <div class="kv">ETA: ${Math.round(travelTime / 1000)}s demo time</div>
          <div class="row" style="margin-top:12px;">
            ${
              name !== state.map.currentPlanet
                ? `<button class="btn btn-primary" onclick="travelTo('${escapeJsString(name)}')" ${state.travel.active || state.events.active ? 'disabled' : ''}>Travel</button>`
                : `<span class="badge badge-good">Current Location</span>`
            }
            <button class="btn" onclick="navigate('map')">Back</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function scanSystem() {
  if (state.travel.active || state.events.active) {
    addLog("Cannot scan while travelling or during an active event.");
    return;
  }

  if (state.player.energy < 2) {
    addLog("Not enough energy to scan.");
    return;
  }

  const system = currentSystemData();
  const undiscovered = system.planets.filter(p => !p.discovered);

  if (undiscovered.length === 0) {
    addLog("No unknown signals remain in this system.");
    return;
  }

  state.player.energy -= 2;
  addLog(`Scanning nearby space in ${state.map.currentSystem}...`);
  renderTopbar();

  setTimeout(() => {
    const discoveredPlanet = undiscovered[Math.floor(Math.random() * undiscovered.length)];
    discoveredPlanet.discovered = true;
    discoveredPlanet.scanned = true;
    system.scanned += 1;

    const scanTexts = [
      "Weak orbital signatures resolved into a planetary body.",
      "A previously unstable sensor echo has been identified.",
      "Scanner sweep confirms a new navigable target.",
      "Long-range telemetry locks onto a hidden planetary mass."
    ];

    const text = scanTexts[Math.floor(Math.random() * scanTexts.length)];

    addLog(text);
    addLog(`Discovery complete: ${discoveredPlanet.name} detected.`);
    gainXp(12, "System scan");
    addLog(`Type: ${discoveredPlanet.type} | Distance: ${discoveredPlanet.distance} | Danger: ${discoveredPlanet.danger}`);
    if (typeof updateMissionProgress === "function") {
      updateMissionProgress("scan_discovery", {
        planetName: discoveredPlanet.name,
        systemName: state.map.currentSystem
      });
    }

    renderTopbar();
    navigate('map');
  }, 2000);
}

function viewDebris(id) {
  state.ui.currentPage = "debris";
  state.map.selectedDebrisId = id;
  const system = currentSystemData();
  const field = system.debrisFields.find(d => d.id === id);

  if (!field) {
    addLog("Debris field not found.");
    navigate('map');
    return;
  }

  state.map.selectedDebrisId = id;

  let contentsHtml = "";
  if (!field.scanned) {
    contentsHtml = `
      <div class="kv">Contents: Unknown</div>
      <div class="kv">Signal: Weak / Incomplete</div>
    `;
  } else {
    contentsHtml = `
      <div class="kv">Contents Report:</div>
      <div class="subtle">${field.scanReport}</div>
    `;
  }

  document.getElementById("main").innerHTML = `
    ${renderTravelPanel()}
    ${renderEventPanel()}

    <div class="panel">
      <div class="panel-header">${field.name}</div>
      <div class="kv">Near: ${field.near}</div>
      <div class="kv">Source: ${field.source}</div>
      <div class="kv">Scanned: ${field.scanned ? "Yes" : "No"}</div>
      <div class="kv">Salvaged: ${field.salvaged ? "Yes" : "No"}</div>
      <div class="kv">Stability: ${field.stability}%</div>
      <div class="kv">Lifetime: ${field.lifetimeHours}h</div>
      <br>
      ${contentsHtml}
      <br>
      <button class="btn" onclick="scanDebris('${field.id}')" ${field.scanned ? 'disabled' : ''}>Scan Debris</button>
      <button class="btn" onclick="salvageDebris('${field.id}')" ${field.salvaged ? 'disabled' : ''}>Begin Salvage</button>
      <button class="btn" onclick="navigate('map')">Back</button>
    </div>

    <div class="panel">
      <div class="panel-header">Damaged Components</div>
      ${renderDamagedComponents()}
    </div>
  `;
}


const CHARACTER_FACTIONS = {
  human: { name: 'Human', perks: 'Balanced adaptability — Common Tongue.' },
  aetherian: { name: 'Aetherian', perks: 'Research and scan specialists — Aether Script.' },
  gravari: { name: 'Gravari', perks: 'Repair and salvage specialists — Grav Dialect.' },
  zypher: { name: 'Zypher', perks: 'Fast movers and code-readers — Zyph Code.' },
  khartek: { name: "Khar’tek", perks: 'Harsh frontier survivors — War Cant.' },
  nexari: { name: 'Nexari', perks: 'Trade masters and brokers — Trade Lexicon.' }
};

function renderCharacterCreation() {
  state.ui.currentPage = "character";
  state.ui.selectedPlanetName = null;
  state.map.selectedDebrisId = null;
  const main = document.getElementById('main');
  const p = state.player;
  const selectedGender = p.gender || '';
  const selectedFaction = p.faction || "";
  main.innerHTML = `
    <div class="page-title">Character Creation</div>
    <div class="page-subtitle">Create your first commander before entering the frontier.</div>
    <div class="panel">
      <div class="panel-header">Commander Profile</div>
      <div class="settings-grid">
        <label class="settings-field">
          <span>Name</span>
          <input id="char-name" class="settings-input" type="text" maxlength="24" value="${p.name || ''}" placeholder="Commander name" />
        </label>
        <label class="settings-field">
          <span>Gender</span>
          <select id="char-gender" class="settings-input">
            <option value="">Select gender</option>
            <option value="male" ${selectedGender === 'male' ? 'selected' : ''}>Male (+5% resistance)</option>
            <option value="female" ${selectedGender === 'female' ? 'selected' : ''}>Female (+5% evasion)</option>
            <option value="enby" ${selectedGender === 'enby' ? 'selected' : ''}>Enby (+2.5% resistance, +2.5% evasion)</option>
          </select>
        </label>
      </div>
      <div class="panel-header" style="margin-top:18px;">Faction</div>
      <div class="settings-grid tribe-grid">
        ${Object.entries(CHARACTER_FACTIONS).map(([key, tribe]) => `
          <label class="tribe-card ${selectedFaction === key ? 'tribe-card-selected' : ''}">
            <input type="radio" name="char-faction" value="${key}" ${selectedFaction === key ? 'checked' : ''} />
            <div class="tribe-name">${tribe.name}</div>
            <div class="subtle">${tribe.perks}</div>
          </label>
        `).join('')}
      </div>
      <div class="row" style="margin-top:18px;">
        <button class="btn btn-primary" onclick="createCharacter()">Enter FutureUnknown</button>
        <button class="btn" onclick="resetGameAndRestart()">Reset Save</button>
      </div>
    </div>
  `;
  renderTopbar();
}

function createCharacter() {
  const name = (document.getElementById('char-name')?.value || '').trim();
  const gender = document.getElementById('char-gender')?.value || '';
  const faction = document.querySelector('input[name="char-faction"]:checked')?.value || '';

  if (!name) {
    addLog('Character creation incomplete: name required.');
    return;
  }
  if (!gender || !faction) {
    addLog('Character creation incomplete: select gender and faction.');
    return;
  }

  state.player.name = name;
  state.player.gender = gender;
  state.player.faction = faction;
  state.player.tribe = null;
  state.player.created = true;
  if (typeof FACTIONS !== 'undefined' && FACTIONS[faction]) {
    state.player.homeSystem = FACTIONS[faction].homeSystem;
    state.player.homePlanet = FACTIONS[faction].homeworld;
    state.player.language = FACTIONS[faction].language;
    state.player.knownLanguages = [FACTIONS[faction].language];
    if (!state.player.knownLanguages.includes("Common Tongue")) state.player.knownLanguages.push("Common Tongue");
    state.map.currentSystem = FACTIONS[faction].homeSystem;
    state.map.currentPlanet = FACTIONS[faction].homeworld;
    const home = state.map.systems[state.map.currentSystem]?.planets?.find(x => x.name === state.map.currentPlanet);
    if (home) { home.discovered = true; home.scanned = true; }
  }
  state.player.resistance = 0;
  state.player.evasion = 0;

  if (gender === 'male') state.player.resistance = 0.05;
  if (gender === 'female') state.player.evasion = 0.05;
  if (gender === 'enby') {
    state.player.resistance = 0.025;
    state.player.evasion = 0.025;
  }

  if (typeof applyTribeEffects === 'function') applyTribeEffects();

  addLog(`Commander ${name} registered. Faction: ${CHARACTER_FACTIONS[faction].name}. Native language: ${state.player.language}.`);
  renderTopbar();
  navigate('dashboard');
  saveGame();
}

function renderSettings() {
  state.ui.currentPage = "settings";
  state.ui.selectedPlanetName = null;
  state.map.selectedDebrisId = null;
  const cfg = getPassiveSettings();
  document.getElementById('main').innerHTML = `
    <div class="page-title">Settings</div>
    <div class="page-subtitle">Adjust passive recovery, decay, and core simulation rates for the current build.</div>
    <div class="panel">
      <div class="panel-header">Passive Systems</div>
      <div class="settings-grid">
        <label class="settings-field"><span>Energy recovery per 5 min</span><input id="set-energy" class="settings-input" type="number" step="0.1" min="0" value="${cfg.energyRecoveryPer5Min}"></label>
        <label class="settings-field"><span>Health recovery per 5 min</span><input id="set-health" class="settings-input" type="number" step="0.1" min="0" value="${cfg.healthRecoveryPer5Min}"></label>
        <label class="settings-field"><span>Stamina recovery per 5 min</span><input id="set-stamina" class="settings-input" type="number" step="0.1" min="0" value="${cfg.staminaRecoveryPer5Min}"></label>
        <label class="settings-field"><span>Mood decay per 24 hrs</span><input id="set-mood" class="settings-input" type="number" step="0.1" min="0" value="${cfg.moodDecayPer24h}"></label>
        <label class="settings-field"><span>Nutrition decay per hour</span><input id="set-nutrition" class="settings-input" type="number" step="0.1" min="0" value="${cfg.nutritionDecayPerHour}"></label>
        <label class="settings-field"><span>Fitness decay per 2 hrs</span><input id="set-fitness" class="settings-input" type="number" step="0.1" min="0" value="${cfg.fitnessDecayPer2h}"></label>
        <label class="settings-field"><span>Market restock interval (ms)</span><input id="set-restock" class="settings-input" type="number" step="1000" min="1000" value="${state.market.restockIntervalMs}"></label>
      </div>
      <div class="row" style="margin-top:18px;">
        <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
        <button class="btn" onclick="restoreDefaultSettings()">Restore Defaults</button>
        <button class="btn" onclick="resetGameAndRestart()">Reset Game</button>
      </div>
    </div>
  `;
}

function saveSettings() {
  state.settings.passive.energyRecoveryPer5Min = Math.max(0, Number(document.getElementById('set-energy')?.value || 0));
  state.settings.passive.healthRecoveryPer5Min = Math.max(0, Number(document.getElementById('set-health')?.value || 0));
  state.settings.passive.staminaRecoveryPer5Min = Math.max(0, Number(document.getElementById('set-stamina')?.value || 0));
  state.settings.passive.moodDecayPer24h = Math.max(0, Number(document.getElementById('set-mood')?.value || 0));
  state.settings.passive.nutritionDecayPerHour = Math.max(0, Number(document.getElementById('set-nutrition')?.value || 0));
  state.settings.passive.fitnessDecayPer2h = Math.max(0, Number(document.getElementById('set-fitness')?.value || 0));
  state.settings.market.restockIntervalMs = Math.max(1000, Number(document.getElementById('set-restock')?.value || 120000));
  state.market.restockIntervalMs = state.settings.market.restockIntervalMs;
  addLog('Settings updated.');
  renderTopbar();
  renderSettings();
  saveGame();
}

function restoreDefaultSettings() {
  state.settings = JSON.parse(JSON.stringify(defaultState.settings));
  state.market.restockIntervalMs = state.settings.market.restockIntervalMs;
  addLog('Settings restored to defaults.');
  renderSettings();
  saveGame();
}

function resetGameAndRestart() {
  resetSavedGame();
  window.location.reload();
}
