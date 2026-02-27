// Polyfill localStorage for zustand persist in happy-dom test environment
const store = new Map<string, string>();
const localStoragePolyfill = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: (i: number) => [...store.keys()][i] ?? null,
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStoragePolyfill,
  writable: true,
  configurable: true,
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: localStoragePolyfill,
    writable: true,
    configurable: true,
  });
}

export { store };
