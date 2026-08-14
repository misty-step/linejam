/** @vitest-environment node */
import './canary-test-env';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCanaryContext,
  filterReportForService,
  filterIncidentsForService,
} from '@/scripts/canary/context.mjs';

describe('filterIncidentsForService', () => {
  it('keeps only incidents for the requested service', () => {
    const incidents = {
      incidents: [
        { id: 'a', service: 'linejam' },
        { id: 'b', service: 'other-service' },
        { id: 'c' },
        { id: 'd', error: { service: 'linejam' } },
      ],
    };

    expect(filterIncidentsForService(incidents, 'linejam')).toEqual({
      incidents: [
        { id: 'a', service: 'linejam' },
        { id: 'd', error: { service: 'linejam' } },
      ],
    });
  });

  it('returns an empty incident list when payload is malformed', () => {
    expect(filterIncidentsForService(undefined, 'linejam')).toEqual({
      incidents: [],
    });
    expect(filterIncidentsForService({ incidents: null }, 'linejam')).toEqual({
      incidents: [],
    });
  });
});

describe('filterReportForService', () => {
  it('filters service-scoped report collections', () => {
    expect(
      filterReportForService(
        {
          summary: { errors: 4 },
          error_groups: [
            { id: 'g1', service: 'linejam' },
            { id: 'g2', service: 'other-service' },
          ],
          incidents: [
            { id: 'i1', service: 'linejam' },
            { id: 'i2', service: 'other-service' },
          ],
          recent_transitions: [
            { id: 't1', incident: { service: 'linejam' } },
            { id: 't2', incident: { service: 'other-service' } },
            { id: 't3', transition: 'unscoped' },
          ],
        },
        'linejam'
      )
    ).toEqual({
      summary: { errors: 4 },
      error_groups: [{ id: 'g1', service: 'linejam' }],
      incidents: [{ id: 'i1', service: 'linejam' }],
      recent_transitions: [
        { id: 't1', incident: { service: 'linejam' } },
        { id: 't3', transition: 'unscoped' },
      ],
    });
  });
});

describe('fetchCanaryContext', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.CANARY_API_KEY;
    delete process.env.CANARY_ENDPOINT;
    delete process.env.LINEJAM_CANARY_CONTEXT_TIMEOUT_MS;
    delete process.env.NEXT_PUBLIC_CANARY_API_KEY;
    delete process.env.NEXT_PUBLIC_CANARY_ENDPOINT;
    delete process.env.LINEJAM_CANARY_SERVICE;
    vi.restoreAllMocks();
  });

  it('throws when API key is not configured', async () => {
    delete process.env.CANARY_API_KEY;
    delete process.env.NEXT_PUBLIC_CANARY_API_KEY;

    await expect(fetchCanaryContext('linejam')).rejects.toThrow(
      'CANARY_API_KEY is required for responder context fetches'
    );
  });

  it('throws when Canary API returns a non-2xx status', async () => {
    process.env.CANARY_API_KEY = 'key';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }) as unknown as typeof fetch;

    await expect(fetchCanaryContext('linejam')).rejects.toThrow(
      'Canary API /api/v1/report returned 500 Internal Server Error'
    );
  });

  it('requests report/timeline/incidents and filters incidents by service', async () => {
    process.env.CANARY_API_KEY = 'secret';
    process.env.CANARY_ENDPOINT = 'https://canary.example.com/';
    process.env.LINEJAM_CANARY_SERVICE = 'linejam';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: { errorRate: 0 },
          error_groups: [
            { id: 'group-linejam', service: 'linejam' },
            { id: 'group-other', service: 'other' },
          ],
          recent_transitions: [
            { id: 'transition-linejam', incident: { service: 'linejam' } },
            { id: 'transition-other', incident: { service: 'other' } },
            { id: 'transition-unscoped', state: 'investigating' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [{ event: 'error.new_class' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          incidents: [
            { id: 'keep-service', service: 'linejam' },
            { id: 'drop-service', service: 'other' },
            { id: 'drop-unscoped' },
          ],
        }),
      });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const context = await fetchCanaryContext();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.any(URL),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer secret',
        },
        signal: expect.any(AbortSignal),
      })
    );

    const reportUrl = fetchMock.mock.calls[0]?.[0] as URL;
    const timelineUrl = fetchMock.mock.calls[1]?.[0] as URL;
    const incidentsUrl = fetchMock.mock.calls[2]?.[0] as URL;

    expect(reportUrl.toString()).toContain(
      'https://canary.example.com/api/v1/report'
    );
    expect(reportUrl.searchParams.get('service')).toBeNull();
    expect(reportUrl.searchParams.get('window')).toBe('1h');
    expect(timelineUrl.searchParams.get('window')).toBe('24h');
    expect(timelineUrl.searchParams.get('event_type')).toContain(
      'error.regression'
    );
    expect(timelineUrl.searchParams.get('event_type')).toContain(
      'health_check.recovered'
    );
    expect(incidentsUrl.toString()).toContain(
      'https://canary.example.com/api/v1/incidents'
    );

    expect(context.report).toEqual({
      summary: { errorRate: 0 },
      error_groups: [{ id: 'group-linejam', service: 'linejam' }],
      recent_transitions: [
        { id: 'transition-linejam', incident: { service: 'linejam' } },
        { id: 'transition-unscoped', state: 'investigating' },
      ],
    });
    expect(context.incidents).toEqual({
      incidents: [{ id: 'keep-service', service: 'linejam' }],
    });
  });

  it('does not use NEXT_PUBLIC Canary key for server-side context fetches', async () => {
    delete process.env.CANARY_API_KEY;
    delete process.env.CANARY_ENDPOINT;
    process.env.NEXT_PUBLIC_CANARY_API_KEY = 'public-key-should-be-ignored';
    process.env.NEXT_PUBLIC_CANARY_ENDPOINT =
      'https://public-canary.example.com/';

    await expect(fetchCanaryContext('linejam')).rejects.toThrow(
      'CANARY_API_KEY is required for responder context fetches'
    );
  });

  it('uses the configured context timeout when querying Canary', async () => {
    process.env.CANARY_API_KEY = 'secret';
    process.env.LINEJAM_CANARY_CONTEXT_TIMEOUT_MS = '1234';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ incidents: [] }),
    }) as unknown as typeof fetch;

    await fetchCanaryContext('linejam');

    const fetchOptions = (
      globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[1];
    expect(fetchOptions?.signal).toBeInstanceOf(AbortSignal);
  });
});
