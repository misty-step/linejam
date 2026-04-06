import '@testing-library/jest-dom';

const hasStorageApi = (storage: unknown): storage is Storage =>
  Boolean(
    storage &&
    typeof storage === 'object' &&
    typeof (storage as Storage).getItem === 'function' &&
    typeof (storage as Storage).setItem === 'function' &&
    typeof (storage as Storage).removeItem === 'function' &&
    typeof (storage as Storage).clear === 'function'
  );

const getDefinedStorageValue = (name: 'localStorage' | 'sessionStorage') => {
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
  if (hasStorageApi(getDefinedStorageValue(name))) {
    return;
  }

  const storage = createMemoryStorage();

  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    writable: true,
    value: storage,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, name, {
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
