/**
 * Mock for react-leaflet.
 *
 * Leaflet requires a real browser DOM with canvas support which jsdom does
 * not provide. This mock replaces every react-leaflet component with a
 * minimal React stub that renders predictable HTML, allowing tests to
 * assert on markers, popups and map structure without a real map engine.
 */
const React = require("react");

const MapContainer = ({ children, ...props }) =>
  React.createElement("div", { "data-testid": "map-container", ...props }, children);

const TileLayer = () => React.createElement("div", { "data-testid": "tile-layer" });

const CircleMarker = ({ children, center, ...props }) =>
  React.createElement(
    "div",
    {
      "data-testid": "circle-marker",
      "data-lat": center?.[0],
      "data-lng": center?.[1],
      ...props,
    },
    children
  );

const Popup = ({ children }) =>
  React.createElement("div", { "data-testid": "popup" }, children);

const Marker = ({ children, position }) =>
  React.createElement(
    "div",
    {
      "data-testid": "marker",
      "data-lat": position?.[0],
      "data-lng": position?.[1],
    },
    children
  );

const useMap = () => ({
  setView: jest.fn(),
  getZoom: jest.fn(() => 12),
});

module.exports = {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Marker,
  useMap,
};
