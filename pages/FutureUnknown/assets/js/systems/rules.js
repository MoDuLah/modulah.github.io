
function isSafeZone() {
  const sys = state.map.currentSystem;
  const planet = state.map.systems?.[sys]?.planets?.find(p=>p.name===state.map.currentPlanet);
  return planet?.safeZone === true;
}
