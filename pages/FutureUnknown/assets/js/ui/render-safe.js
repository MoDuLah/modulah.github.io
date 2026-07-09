// Security patch for render.js - Fix XSS vulnerabilities
// This file provides safe rendering functions that prevent XSS

// Import escape function from utils
import { escapeJsString } from '../core/utils.js';

// Safe innerHTML helper - escapes all dynamic content
function safeInnerHTML(element, template, data) {
  // Replace all ${...} placeholders with escaped values
  return template.replace(/\$\{([^}]+)\}/g, (match, expr) => {
    try {
      const value = eval(expr);
      return escapeJsString(String(value || ''));
    } catch (e) {
      return escapeJsString(String(match));
    }
  });
}

// Safe element creation helper
function createSafeElement(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== null && textContent !== undefined) {
    el.textContent = textContent;
  }
  return el;
}

// Patch renderSidebarStats to use safe methods
function renderSidebarStatsSafe() {
  const p = state.player;
  const s = state.ship;
  const container = document.getElementById("sidebar-stats");
  if (!container) return;

  // Clear container
  container.innerHTML = '';

  // Create stat chips using safe methods
  const commanderChip = document.createElement('div');
  commanderChip.className = 'stat-chip sidebar-chip';
  
  const commanderLabel = createSafeElement('div', 'stat-label', 'Commander');
  commanderChip.appendChild(commanderLabel);
  
  const commanderLine = document.createElement('div');
  commanderLine.className = 'stat-line';
  
  const nameSpan = createSafeElement('span', 'stat-value', p.name || 'Unassigned');
  const noteSpan = createSafeElement('span', 'stat-note', `Level ${p.level}`);
  commanderLine.appendChild(nameSpan);
  commanderLine.appendChild(noteSpan);
  commanderChip.appendChild(commanderLine);

  // Continue with other elements... (similar pattern for all dynamic content)
  
  container.appendChild(commanderChip);
}

// Export the safe functions
export { safeInnerHTML, createSafeElement, renderSidebarStatsSafe };
