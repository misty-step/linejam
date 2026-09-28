// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import {
  ConvexProviderWithAuth,
  useConvexAuth,
  type ConvexReactClient,
} from 'convex/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { UserProvider, useUser } from '@/lib/auth';

// US-001: switching from guest play to an account must await server proof,
// without misreporting the previous anonymous state as a rejected account.
describe('Convex account handshake', () => {
  it.each([true, false])(
    'waits for the server before exposing an accepted=%s account result',
    async (accepted) => {
      let signedIn = false;
      let confirm: (authenticated: boolean) => void = () => {
        throw new Error('Auth handshake has not started');
      };
      const client = {
        setAuth: (
          _fetchToken: Parameters<ConvexReactClient['setAuth']>[0],
          onChange: (authenticated: boolean) => void
        ) => {
          confirm = onChange;
        },
        clearAuth: () => {},
      };
      const fetchAccessToken = async () => 'account-token';
      const useAuth = () => ({
        isLoading: false,
        isAuthenticated: signedIn,
        fetchAccessToken,
      });
      const onError = vi.fn();
      const dependencies = {
        useAccount: () => ({
          kind: 'clerk' as const,
          user: signedIn ? { id: 'account' } : null,
          isLoaded: true,
          convex: useConvexAuth(),
        }),
        onError,
      };
      const fetcher = {
        fetch: async () => ({ guestId: 'guest', token: 'guest-token' }),
      };
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ConvexProviderWithAuth client={client} useAuth={useAuth}>
          <UserProvider fetcher={fetcher} dependencies={dependencies}>
            {children}
          </UserProvider>
        </ConvexProviderWithAuth>
      );
      const { result, rerender } = renderHook(() => useUser(), { wrapper });
      await act(async () => {});
      expect(result.current.guestToken).toBe('guest-token');

      signedIn = true;
      await act(async () => rerender());
      expect(result.current.guestToken).toBeNull();
      expect(result.current.isLoading).toBe(true);
      expect(result.current.authError).toBeNull();
      expect(onError).not.toHaveBeenCalled();

      act(() => confirm(accepted));
      expect(result.current.isLoading).toBe(false);
      if (accepted) {
        expect(result.current.authError).toBeNull();
        expect(onError).not.toHaveBeenCalled();
      } else {
        expect(result.current.authError).not.toBeNull();
        expect(onError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
          operation: 'convexAuthUnavailable',
        });
      }
    }
  );
});
