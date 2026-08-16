import '@testing-library/jest-dom';

const hasStorageApi = (
  storage: Partial<Storage> | null | undefined
): storage is Storage => {
  if (!storage) {
    return false;
  }

  try {
    return (
      storage.getItem instanceof Function &&
      storage.setItem instanceof Function &&
      storage.removeItem instanceof Function &&
      storage.clear instanceof Function
    );
  } catch {
    return false;
  }
};

const getDefinedStorageValue = (
  name: 'localStorage' | 'sessionStorage'
): Partial<Storage> | null | undefined => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);

  if (!descriptor || !('value' in descriptor)) {
    return undefined;
  }

  return descriptor.value;
};

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(String(key)) ?? null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
  };
};

const installStorageShim = (name: 'localStorage' | 'sessionStorage') => {
  const definedStorage = getDefinedStorageValue(name);
  if (hasStorageApi(definedStorage)) {
    if ('window' in globalThis && globalThis.window !== undefined) {
      Object.defineProperty(globalThis.window, name, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: definedStorage,
      });
    }
    return;
  }

  const storage = createMemoryStorage();

  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    writable: true,
    value: storage,
  });

  if ('window' in globalThis && globalThis.window !== undefined) {
    Object.defineProperty(globalThis.window, name, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: storage,
    });
  }
};

// Node 22 exposes a partial webstorage global that breaks happy-dom tests.
installStorageShim('localStorage');
installStorageShim('sessionStorage');
