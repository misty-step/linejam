// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AudioProvider,
  createAudioController,
  useAudio,
  useGuestCredential,
  useHeartbeat,
  useWakeLock,
} from "../src/index.js";

const testClock = () => 1_000;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe("useHeartbeat", () => {
  it("keeps one heartbeat when inline callbacks change and sends with the latest behavior", async () => {
    vi.useFakeTimers();
    const send = vi.fn();
    let renders = 0;
    const { result, rerender, unmount } = renderHook(
      ({ version }) => {
        if (++renders > 30) {
          throw new Error("Inline heartbeat callbacks restarted the render lifecycle.");
        }
        return useHeartbeat({
          send: () => send(version),
          clock: () => Date.now(),
          document: null,
          intervalMs: 1_000,
        });
      },
      { initialProps: { version: 1 } },
    );
    expect(result.current.inFlight).toBe(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.inFlight).toBe(false);
    rerender({ version: 2 });
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(send.mock.calls).toEqual([[1], [2]]);
    unmount();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe("useWakeLock", () => {
  it("releases the browser lock when the hook unmounts", async () => {
    const release = vi.fn(() => Promise.resolve());
    const sentinel = {
      released: false,
      release,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const request = vi.fn(() => Promise.resolve(sentinel));
    const navigatorRef = { wakeLock: { request } };
    const documentRef = {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const { result, unmount } = renderHook(() =>
      useWakeLock({ navigator: navigatorRef, document: documentRef }),
    );
    await act(async () => {
      await result.current.start();
    });

    expect(request).toHaveBeenCalledWith("screen");
    expect(result.current.status).toBe("active");
    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe("useGuestCredential", () => {
  it("acquires and clears only the opaque credential value", async () => {
    let stored: string | null = null;
    const storage = {
      getItem: vi.fn(() => stored),
      setItem: vi.fn((_key: string, value: string) => {
        stored = value;
      }),
      removeItem: vi.fn(() => {
        stored = null;
      }),
    };
    const issuer = vi.fn(async () => ({ token: "opaque-guest-value", expiresAt: 10_000 }));
    const { result } = renderHook(() => useGuestCredential({ storage, issuer, clock: testClock }));

    await act(async () => {
      await result.current.acquire();
    });

    expect(result.current.credential).toBe("opaque-guest-value");
    act(() => {
      result.current.clear();
    });
    expect(result.current.credential).toBeNull();
    await act(async () => {
      await result.current.acquire();
    });
    expect(result.current.credential).toBe("opaque-guest-value");
    expect(issuer).toHaveBeenCalledTimes(2);
  });

  it("ignores a cancelled acquire while a replacement remains pending", async () => {
    let stored: string | null = null;
    const storage = {
      getItem: vi.fn(() => stored),
      setItem: vi.fn((_key: string, value: string) => {
        stored = value;
      }),
      removeItem: vi.fn(() => {
        stored = null;
      }),
    };
    const stale = deferred<{ token: string; expiresAt: number }>();
    const replacement = deferred<{ token: string; expiresAt: number }>();
    const issuer = vi
      .fn<() => Promise<{ token: string; expiresAt: number }>>()
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => replacement.promise);
    const { result } = renderHook(() => useGuestCredential({ storage, issuer, clock: testClock }));

    let staleAcquisition!: Promise<unknown>;
    act(() => {
      staleAcquisition = result.current.acquire();
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.clear();
    });
    expect(result.current.credential).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    let replacementAcquisition!: Promise<unknown>;
    act(() => {
      replacementAcquisition = result.current.acquire();
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      stale.resolve({ token: "stale-token", expiresAt: 10_000 });
      await expect(staleAcquisition).rejects.toMatchObject({ code: "cancelled" });
    });
    expect(result.current.credential).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(stored).toBeNull();

    await act(async () => {
      replacement.resolve({ token: "fresh-token", expiresAt: 10_000 });
      await expect(replacementAcquisition).resolves.toBe("fresh-token");
    });
    expect(result.current.credential).toBe("fresh-token");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("keeps memory-only identity across inline issuers and parent rerenders", async () => {
    const issue = vi.fn(async (version: number, _input: unknown) => ({
      token: `identity-${version}`,
      expiresAt: 10_000,
    }));
    let renders = 0;
    const { result, rerender } = renderHook(
      ({ version }) => {
        if (++renders > 30) {
          throw new Error("Inline issuer restarted the credential lifecycle.");
        }
        return useGuestCredential({
          storage: null,
          autoAcquire: true,
          clock: () => 1_000,
          issuer: (input) => issue(version, input),
        });
      },
      { initialProps: { version: 1 } },
    );
    await act(async () => {
      await result.current.acquire();
    });
    expect(result.current.credential).toBe("identity-1");
    expect(result.current.loading).toBe(false);
    rerender({ version: 2 });
    await act(async () => {
      await result.current.acquire();
    });
    expect(result.current.credential).toBe("identity-1");
    expect(issue).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.refresh();
    });
    expect(issue).toHaveBeenLastCalledWith(2, { mode: "refresh", token: "identity-1" });
    expect(result.current.credential).toBe("identity-2");
  });

  it("renews automatically but never exposes expired credentials while renewal is pending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const renewal = deferred<{ token: string; expiresAt: number }>();
    const issuer = vi
      .fn()
      .mockResolvedValueOnce({ token: "first", expiresAt: 61_000 })
      .mockImplementationOnce(() => renewal.promise);
    const { result } = renderHook(() =>
      useGuestCredential({ storage: null, autoAcquire: true, issuer }),
    );
    await act(async () => {
      await result.current.acquire();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(issuer).toHaveBeenLastCalledWith({ mode: "refresh", token: "first" });
    expect(result.current.credential).toBe("first");
    expect(result.current.loading).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current.credential).toBeNull();
    expect(result.current.expiresAt).toBe(61_000);
    await act(async () => {
      renewal.resolve({ token: "renewed", expiresAt: 121_000 });
      await result.current.refresh();
    });
    expect(result.current.credential).toBe("renewed");
    expect(result.current.expiresAt).toBe(121_000);
    expect(result.current.loading).toBe(false);
  });

  it("expires credentials even when automatic acquisition is disabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const issuer = vi.fn(async () => ({ token: "manual", expiresAt: 2_000 }));
    const { result } = renderHook(() => useGuestCredential({ storage: null, issuer }));
    await act(async () => {
      await result.current.acquire();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current.credential).toBeNull();
    expect(result.current.expiresAt).toBe(2_000);
    expect(issuer).toHaveBeenCalledTimes(1);
  });

  it("recovers expired proof through trusted refresh and waits for an explicit retry after failure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let stored: string | null = JSON.stringify({ token: "old-proof", expiresAt: 1_000 });
    const storage = {
      getItem: () => stored,
      setItem: (_key: string, value: string) => {
        stored = value;
      },
      removeItem: () => {
        stored = null;
      },
    };
    const issuer = vi
      .fn()
      .mockRejectedValueOnce(new Error("session rejected"))
      .mockImplementationOnce(async () => ({
        token: "trusted-retry",
        expiresAt: Date.now() + 60_000,
      }));
    const { result, rerender } = renderHook(() =>
      useGuestCredential({ storage, autoAcquire: true, issuer: (input) => issuer(input) }),
    );
    await act(async () => {
      await expect(result.current.acquire()).rejects.toThrow("session rejected");
    });
    expect(issuer).toHaveBeenCalledWith({ mode: "refresh", token: "old-proof" });
    expect(result.current.credential).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_600_000);
    });
    expect(issuer).toHaveBeenCalledTimes(1);
    expect(stored).toContain("old-proof");
    await act(async () => {
      await result.current.refresh();
    });
    expect(issuer).toHaveBeenLastCalledWith({ mode: "refresh", token: "old-proof" });
    expect(result.current.credential).toBe("trusted-retry");
    expect(result.current.error).toBeNull();
  });

  it("does not issue for a discarded Strict Mode lifecycle", async () => {
    const issuer = vi.fn(async () => ({ token: "strict-identity", expiresAt: 10_000 }));
    const { result } = renderHook(
      () => useGuestCredential({ storage: null, autoAcquire: true, issuer, clock: testClock }),
      { wrapper: StrictMode },
    );
    await act(async () => {
      await result.current.acquire();
    });
    expect(result.current.credential).toBe("strict-identity");
    expect(issuer).toHaveBeenCalledTimes(1);
  });
});

describe("useGuestCredential store identity", () => {
  it("does not expose a prior store credential when dependencies change", async () => {
    const firstStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const secondStorage = {
      getItem: vi.fn(() => JSON.stringify({ token: "token-two", expiresAt: 10_000 })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const firstIssuer = vi.fn(async () => ({ token: "token-one", expiresAt: 10_000 }));
    const secondIssuer = vi.fn(async () => ({ token: "token-three", expiresAt: 10_000 }));
    type Props = {
      storage: typeof firstStorage;
      key: string;
      issuer: typeof firstIssuer;
    };
    const { result, rerender } = renderHook(
      (props: Props) =>
        useGuestCredential({
          ...props,
          autoAcquire: true,
          clock: testClock,
        }),
      {
        initialProps: {
          storage: firstStorage,
          key: "first",
          issuer: firstIssuer,
        },
      },
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.credential).toBe("token-one");

    rerender({
      storage: secondStorage,
      key: "second",
      issuer: secondIssuer,
    });
    expect(result.current.credential).not.toBe("token-one");
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.credential).toBe("token-two");
  });

  it("ignores pending issuance after owner changes and unmount without persisting stale identity", async () => {
    let firstStored: string | null = null;
    let secondStored: string | null = null;
    const firstStorage = {
      getItem: () => firstStored,
      setItem: (_key: string, value: string) => {
        firstStored = value;
      },
      removeItem: () => {
        firstStored = null;
      },
    };
    const secondStorage = {
      getItem: () => secondStored,
      setItem: (_key: string, value: string) => {
        secondStored = value;
      },
      removeItem: () => {
        secondStored = null;
      },
    };
    const stale = deferred<{ token: string; expiresAt: number }>();
    const replacement = deferred<{ token: string; expiresAt: number }>();
    const issuer = vi
      .fn()
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => replacement.promise);
    const { result, rerender, unmount } = renderHook(
      ({ storage }) => useGuestCredential({ storage, autoAcquire: true, issuer, clock: testClock }),
      { initialProps: { storage: firstStorage } },
    );
    const firstAcquisition = result.current.acquire();
    await act(async () => {
      await Promise.resolve();
    });
    rerender({ storage: secondStorage });
    const secondAcquisition = result.current.acquire();
    await act(async () => {
      await Promise.resolve();
      stale.resolve({ token: "old-owner", expiresAt: 10_000 });
      await expect(firstAcquisition).rejects.toMatchObject({ code: "cancelled" });
    });
    expect(firstStored).toBeNull();
    expect(result.current.credential).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    unmount();
    replacement.resolve({ token: "unmounted-owner", expiresAt: 10_000 });
    await expect(secondAcquisition).rejects.toMatchObject({ code: "cancelled" });
    expect(secondStored).toBeNull();
  });
});

describe("useAudio", () => {
  it("reads audio snapshot and responds to mute and volume updates", () => {
    const played: string[] = [];
    const controller = createAudioController({
      storage: null,
      engine: {
        play: (name) => {
          played.push(name ?? "default");
        },
        setEnabled: () => {},
        setVolume: () => {},
        bind: () => {},
      },
    });

    const { result } = renderHook(() => useAudio({ controller, autoBind: false }));

    expect(result.current.enabled).toBe(true);
    expect(result.current.volume).toBe(1);

    act(() => {
      result.current.play("join");
    });
    expect(played).toEqual(["sparkle"]);

    act(() => {
      result.current.toggleMuted();
    });
    expect(result.current.enabled).toBe(false);

    act(() => {
      result.current.setVolume(0.5);
    });
    expect(result.current.volume).toBe(0.5);
  });

  it("inherits controller provided by AudioProvider context", () => {
    const played: string[] = [];
    const controller = createAudioController({
      storage: null,
      engine: {
        play: (name) => {
          played.push(name ?? "default");
        },
        setEnabled: () => {},
        setVolume: () => {},
        bind: () => {},
      },
    });

    const wrapper = ({ children }: { children?: React.ReactNode }) => (
      <AudioProvider controller={controller} autoBind={false}>
        {children}
      </AudioProvider>
    );

    const { result } = renderHook(() => useAudio({ autoBind: false }), { wrapper });

    expect(result.current.controller).toBe(controller);
    act(() => {
      result.current.play("win");
    });
    expect(played).toEqual(["success"]);
  });
});
