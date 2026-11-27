// Runs synchronously in <head>, before first paint: the saved mode applies
// with no flash of the other mode. No saved choice means System.
try {
  const saved = localStorage.getItem('linejam:theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch {
  // Storage unavailable: System.
}
