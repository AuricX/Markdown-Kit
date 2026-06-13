import "@testing-library/jest-dom/vitest";

// jsdom lacks ResizeObserver, which react-resizable-panels relies on to lay out
// its panels. A no-op stub is enough for component tests.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    ResizeObserverStub;
}
