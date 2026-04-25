function addLog(text) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const entryText = `[${hh}:${mm}] ${text}`;

  if (!state.ui) state.ui = {};
  if (!Array.isArray(state.ui.logEntries)) state.ui.logEntries = [];

  state.ui.logEntries.push(entryText);
  if (state.ui.logEntries.length > 250) {
    state.ui.logEntries = state.ui.logEntries.slice(-250);
  }

  const log = document.getElementById("log");
  if (!log) return;

  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = entryText;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function renderStoredLog() {
  const log = document.getElementById("log");
  if (!log) return;

  log.innerHTML = "";
  const entries = state.ui && Array.isArray(state.ui.logEntries) ? state.ui.logEntries : [];
  entries.forEach(text => {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.textContent = text;
    log.appendChild(entry);
  });
  log.scrollTop = log.scrollHeight;
}
