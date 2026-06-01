// No-op mock for leaflet.heat side-effect import.
// leaflet.heat normally augments L with L.heatLayer; the L mock in leaflet.js
// already provides heatLayer, so this module intentionally does nothing.
module.exports = {};
