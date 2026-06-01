/**
 * Mock for the leaflet package (required directly in ReportsMap via require()).
 * Prevents Leaflet from attempting real DOM operations in jsdom.
 */
const heatLayerInstance = {
  addTo: jest.fn(),
  remove: jest.fn(),
};

const leaflet = {
  Icon: {
    Default: {
      prototype: {},
      mergeOptions: jest.fn(),
    },
  },
  map: jest.fn(() => ({
    setView: jest.fn(),
    addLayer: jest.fn(),
    remove: jest.fn(),
  })),
  tileLayer: jest.fn(() => ({ addTo: jest.fn() })),
  circleMarker: jest.fn(() => ({ addTo: jest.fn() })),
  // Phase 04-04: HeatmapLayer uses heatLayer + control.layers
  heatLayer: jest.fn(() => heatLayerInstance),
  control: {
    layers: jest.fn(() => ({ addTo: jest.fn(), remove: jest.fn() })),
  },
};

module.exports = leaflet;
