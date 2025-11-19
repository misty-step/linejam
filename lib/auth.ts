import { useUser as useClerkUser } from '@clerk/nextjs';
import { useSyncExternalStore } from 'react';

// Subscribe to storage changes (minimal implementation for SSR support)
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getGuestIdSnapshot() {
  if (typeof window === 'undefined') return null;
  let stored = localStorage.getItem('linejam_guest_id');
  if (!stored) {
    stored = crypto.randomUUID();
    localStorage.setItem('linejam_guest_id', stored);
  }
  return stored;
}

function getServerSnapshot() {
  return null;
}

export function useUser() {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useClerkUser();
  const guestId = useSyncExternalStore(
    subscribe,
    getGuestIdSnapshot,
    getServerSnapshot
  );
  const isGuestLoaded = guestId !== null;

  const isLoading = !isClerkLoaded || !isGuestLoaded;

  // If clerkUser is present, we use that.
  // If not, we use guestId.
  // We always return guestId because we might need it for "ensureUser" if the user is not logged in.

  return {
    clerkUser,
    guestId,
    isLoading,
    isAuthenticated: !!clerkUser,
    displayName: clerkUser?.fullName || clerkUser?.firstName || 'Guest',
  };
}
