'use client';

import { createContext, useContext } from 'react';

export type ClerkAccountState = {
  kind: 'clerk';
  user: {
    id: string;
    fullName?: string | null;
    firstName?: string | null;
    imageUrl?: string | null;
    primaryEmailAddress?: { emailAddress?: string } | null;
    createdAt?: Date | null;
  } | null;
  isLoaded: boolean;
  convex: { isLoading: boolean; isAuthenticated: boolean };
};

export type AccountState = { kind: 'local' } | ClerkAccountState;
export const AccountContext = createContext<AccountState | null>(null);

/** Account availability is distinct from an anonymous Clerk session. */
export function useAccountState(): AccountState {
  const account = useContext(AccountContext);
  if (!account) throw new Error('AccountProvider is required');
  return account;
}
