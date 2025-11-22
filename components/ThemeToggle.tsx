'use client';

import { useState } from 'react';

// SVG Icon Components
const SunIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

const MoonIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
    />
  </svg>
);

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(() => {
    // Initialize theme from localStorage or system preference
    if (typeof window === 'undefined') return null;

    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (stored) {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(stored);
      return stored;
    }

    // Use system preference
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;
    const systemTheme = prefersDark ? 'dark' : 'light';
    document.documentElement.classList.add(systemTheme);
    return systemTheme;
  });

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(newTheme);
  };

  // Don't render until theme is determined (prevents flash)
  if (!theme) return <div className="w-10 h-10" />;

  return (
    <button
      onClick={toggleTheme}
      className={`w-10 h-10 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-300 ${className}`}
      aria-label="Toggle theme"
    >
      <span className="transition-opacity duration-300">
        {theme === 'light' ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}
