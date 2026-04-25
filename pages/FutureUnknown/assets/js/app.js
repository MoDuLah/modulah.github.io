document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => navigate(item.dataset.page));
  });

  const loaded = loadGame();

  if (typeof applyTribeEffects === 'function') applyTribeEffects();

  renderStoredLog();

  if (loaded) {
    applyOfflineProgress();
    resumeTravelAfterLoad();
    addLog("Save loaded.");
  } else {
    addLog("FutureUnknown systems online.");
  }

  if (!state.player.created) {
    renderCharacterCreation();
  } else {
    renderTopbar();
    navigate(state.ui.currentPage || "dashboard");
  }

  saveGame();

  setInterval(() => runPassiveSystems(5000), 5000);
  window.addEventListener("beforeunload", saveGame);
});
