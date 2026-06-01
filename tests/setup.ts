import '@testing-library/jest-dom/vitest';

// jsdom throws "Not implemented" from canvas getContext; the live view probes
// it and expects null when unavailable. Returning null keeps test output clean
// and the live render loop guarded off under jsdom.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}

// jsdom does not implement matchMedia; uPlot reads it at import time.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
