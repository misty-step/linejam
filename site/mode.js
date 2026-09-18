/* Color mode: Light, Dark, and System. Storage key matches the app. */

(() => {
  const STORAGE_KEY = 'linejam-theme-mode';
  const root = document.documentElement;
  const media = matchMedia('(prefers-color-scheme: dark)');

  const readPreference = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {}
    return 'system';
  };

  const effectiveMode = (preference) => {
    if (preference === 'light' || preference === 'dark') return preference;
    return media.matches ? 'dark' : 'light';
  };

  const applyPreference = (preference) => {
    const mode = effectiveMode(preference);
    root.classList.remove('light', 'dark');
    root.classList.add(mode);
    root.style.colorScheme = mode;
    document.querySelectorAll('input[name="color-mode"]').forEach((input) => {
      input.checked = input.value === preference;
    });
  };

  const setPreference = (preference) => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {}
    applyPreference(preference);
  };

  applyPreference(readPreference());

  document.querySelectorAll('input[name="color-mode"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (
        input.value === 'light' ||
        input.value === 'dark' ||
        input.value === 'system'
      ) {
        setPreference(input.value);
      }
    });
  });

  media.addEventListener('change', () => {
    if (readPreference() === 'system') {
      applyPreference('system');
    }
  });

  document.addEventListener('mousedown', (event) => {
    document.querySelectorAll('details.lj-appearance').forEach((details) => {
      if (!details.contains(event.target)) details.removeAttribute('open');
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document
      .querySelectorAll('details.lj-appearance[open]')
      .forEach((details) => {
        details.removeAttribute('open');
      });
  });
})();
