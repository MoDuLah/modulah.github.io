function createDebrisField(nearPlanetName, source = "Unknown engagement") {
  const system = currentSystemData();

  const templates = [
    {
      name: "Debris Field Alpha",
      hiddenContents: [
        { kind: "material", key: "alloyPlates", amount: 3 },
        { kind: "material", key: "circuitBoards", amount: 1 },
        {
          kind: "damaged",
          component: {
            name: "Damaged Laser Lens",
            repairChance: 72,
            requirements: {
              alloyPlates: 1,
              circuitBoards: 1
            }
          }
        }
      ]
    },
    {
      name: "Debris Field Beta",
      hiddenContents: [
        { kind: "material", key: "energyCells", amount: 2 },
        { kind: "material", key: "alloyPlates", amount: 2 },
        {
          kind: "damaged",
          component: {
            name: "Damaged Engine Coil",
            repairChance: 68,
            requirements: {
              alloyPlates: 2,
              capacitors: 1
            }
          }
        }
      ]
    },
    {
      name: "Debris Field Gamma",
      hiddenContents: [
        { kind: "material", key: "circuitBoards", amount: 2 },
        { kind: "material", key: "capacitors", amount: 1 },
        {
          kind: "damaged",
          component: {
            name: "Cracked Shield Regulator",
            repairChance: 61,
            requirements: {
              alloyPlates: 1,
              energyCells: 1,
              capacitors: 1
            }
          }
        }
      ]
    }
  ];

  const pick = templates[Math.floor(Math.random() * templates.length)];

  const field = {
    id: uid("debris"),
    name: pick.name,
    near: nearPlanetName,
    source,
    scanned: false,
    salvaged: false,
    stability: 60 + Math.floor(Math.random() * 35),
    lifetimeHours: 6 + Math.floor(Math.random() * 18),
    hiddenContents: pick.hiddenContents,
    scanReport: null
  };

  system.debrisFields.push(field);
  return field;
}

function scanDebris(id) {
  const system = currentSystemData();
  const field = system.debrisFields.find(d => d.id === id);

  if (!field) {
    addLog("Debris field not found.");
    return;
  }

  if (state.travel.active || state.events.active) {
    addLog("Cannot scan debris while travelling or during an active event.");
    return;
  }

  if (state.player.energy < 2) {
    addLog("Not enough energy to scan debris.");
    return;
  }

  state.player.energy -= 2;
  addLog(`Scanning debris field near ${field.near}...`);
  renderTopbar();
  saveGame();

  setTimeout(() => {
    field.scanned = true;

    const parts = field.hiddenContents.map(item => {
      if (item.kind === "material") {
        return `${formatComponentName(item.key)} x${item.amount}`;
      }

      if (item.kind === "damaged") {
        return `${item.component.name}`;
      }

      return "Unknown";
    });

    field.scanReport = parts.join(", ");
    addLog(`Debris scan complete: ${field.scanReport}`);

    renderTopbar();
    viewDebris(id);
    saveGame();
  }, 2000);
}

function salvageDebris(id) {
  const system = currentSystemData();
  const field = system.debrisFields.find(d => d.id === id);

  if (!field) {
    addLog("Debris field not found.");
    return;
  }

  if (field.salvaged) {
    addLog("This debris field has already been salvaged.");
    return;
  }

  if (state.player.energy < 4) {
    addLog("Not enough energy to salvage debris.");
    return;
  }

  state.player.energy -= 4;
  addLog(`Salvage operation started at ${field.name}...`);
  renderTopbar();
  saveGame();

  setTimeout(() => {
    field.hiddenContents.forEach(item => {
      if (item.kind === "material") {
        state.inventory.materials[item.key] += item.amount;
        addLog(`Recovered: ${formatComponentName(item.key)} x${item.amount}`);
      }

      if (item.kind === "damaged") {
        state.inventory.damagedComponents.push({
          id: uid("damaged"),
          name: item.component.name,
          repairChance: item.component.repairChance,
          requirements: { ...item.component.requirements }
        });

        addLog(`Recovered damaged component: ${item.component.name}`);
      }
    });

    field.salvaged = true;
    field.hiddenContents = [];
    field.scanReport = "Field stripped. No recoverable contents remain.";

    addLog(`Salvage complete: ${field.name} has been stripped.`);
    gainXp(14, "Salvage operation");
    if (typeof updateMissionProgress === "function") {
      updateMissionProgress("salvage_complete", {
        debrisId: field.id,
        planetName: field.near,
        systemName: state.map.currentSystem
      });
    }
    renderTopbar();
    viewDebris(id);
    saveGame();
  }, 3000);
}

function hasRepairMaterials(requirements) {
  return Object.entries(requirements).every(([key, value]) => {
    return (state.inventory.materials[key] || 0) >= value;
  });
}

function consumeRepairMaterials(requirements) {
  Object.entries(requirements).forEach(([key, value]) => {
    state.inventory.materials[key] -= value;
  });
}

function repairDamagedComponent(id) {
  const component = state.inventory.damagedComponents.find(c => c.id === id);

  if (!component) {
    addLog("Damaged component not found.");
    return;
  }

  if (!hasRepairMaterials(component.requirements)) {
    addLog(`Missing materials to repair ${component.name}.`);
    return;
  }

  if (state.player.credits < 500) {
    addLog("Not enough credits to attempt repair.");
    return;
  }

  consumeRepairMaterials(component.requirements);
  state.player.credits -= 500;

  addLog(`Repair attempt started: ${component.name}...`);
  renderTopbar();
  saveGame();

  setTimeout(() => {
    const success = rollChance(component.repairChance);

    if (success) {
      state.inventory.repairedComponents.push({
        name: component.name.replace("Damaged ", "").replace("Cracked ", "").trim(),
        quality: "Restored"
      });

      state.inventory.damagedComponents = state.inventory.damagedComponents.filter(c => c.id !== id);
      addLog(`Repair success: ${component.name} restored.`);
      gainXp(16, "Component repair");
    } else {
      addLog(`Repair failed: ${component.name} remains unusable.`);
    }

    if (state.map.selectedDebrisId) {
      viewDebris(state.map.selectedDebrisId);
    } else {
      navigate(state.ui.currentPage);
    }

    renderTopbar();
    saveGame();
  }, 2000);
}

function recycleDamagedComponent(id) {
  const component = state.inventory.damagedComponents.find(c => c.id === id);

  if (!component) {
    addLog("Damaged component not found.");
    return;
  }

  state.inventory.damagedComponents = state.inventory.damagedComponents.filter(c => c.id !== id);
  state.inventory.materials.alloyPlates += 1;
  state.inventory.materials.circuitBoards += 1;

  addLog(`Recycled ${component.name} into Alloy Plates x1 and Circuit Boards x1.`);

  if (state.map.selectedDebrisId) {
    viewDebris(state.map.selectedDebrisId);
  } else {
    navigate(state.ui.currentPage);
  }
  saveGame();
}

function repairShip() {
  if (state.player.credits < 1000) {
    addLog("Not enough credits to repair the ship.");
    return;
  }

  const hullMissing = state.ship.hullMax - state.ship.hull;
  const shieldMissing = state.ship.shieldMax - state.ship.shield;

  if (hullMissing === 0 && shieldMissing === 0) {
    addLog("Ship already at full integrity.");
    return;
  }

  state.player.credits -= 1000;
  state.ship.hull = Math.min(state.ship.hullMax, state.ship.hull + 15);
  state.ship.shield = Math.min(state.ship.shieldMax, state.ship.shield + 20);

  addLog("Dockyard crews completed a partial repair cycle.");
  renderTopbar();
  navigate(state.ui.currentPage);
  saveGame();
}
