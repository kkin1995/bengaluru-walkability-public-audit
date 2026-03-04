/**
 * Mock for the leaflet package (required directly in ReportsMap via require()).
 * Prevents Leaflet from attempting real DOM operations in jsdom.
 */
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
};

module.exports = leaflet;
