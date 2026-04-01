import "@testing-library/jest-dom/vitest";

// Polyfill for ReactFlow which requires ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill for Element.prototype.hasPointerCapture (used by ReactFlow drag)
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function () { return false; };
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function () {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = function () {};
}
