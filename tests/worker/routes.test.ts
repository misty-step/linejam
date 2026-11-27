import { describe, expect, it } from 'vitest';
import { call } from './helpers.ts';

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function raw(path: string, accept = '*/*'): Promise<Response> {
  const { exports } = await import('cloudflare:workers');
  const worker = (exports as unknown as { default: { fetch(request: Request): Promise<Response> } }).default;
  return worker.fetch(new Request(`http://linejam.test${path}`, { headers: { accept } }));
}

describe('[L1-5.5] retired release feeds', () => {
  it.each(['/changelog', '/releases', '/releases.xml'])('%s answers 404', async (path) => {
    expect((await raw(path, 'text/html')).status).toBe(404);
    expect((await raw(path)).status).toBe(404);
  });

  it('links to no retired route from the shell', async () => {
    const html = await (await raw('/', 'text/html')).text();
    expect(html).not.toMatch(/changelog|releases/i);
  });
});

describe('[L1-5.2] the Worker serves the UI directly', () => {
  it.each(['/', '/join?code=ABCD', '/room/ABCD', '/poems', '/poem/p_x', '/recap/g_x', '/account'])(
    '%s is a page',
    async (path) => {
      const response = await raw(path, 'text/html');
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      const csp = response.headers.get('content-security-policy')!;
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toContain('unsafe-inline');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    }
  );

  it('answers unknown paths and unknown API routes with 404', async () => {
    expect((await raw('/nope', 'text/html')).status).toBe(404);
    expect((await raw('/host', 'text/html')).status).toBe(404);
    expect((await raw('/api/nope')).status).toBe(401);
    expect((await call('GET', '/api/health')).body).toMatchObject({ status: 'ok', environment: 'local' });
  });
});

describe('[D1-2] canonical assets are served byte-exact', () => {
  it('matches every SHA-256 in folio/assets/checksums.json', async () => {
    const manifest = (await (await raw('/folio/checksums.json')).json()) as Record<string, string>;
    expect(Object.keys(manifest)).toHaveLength(10);
    for (const [name, expected] of Object.entries(manifest)) {
      const response = await raw(`/folio/${name}`);
      expect(response.status).toBe(200);
      expect(await sha256(await response.arrayBuffer()), name).toBe(expected);
    }
  });

  it('serves raster icons derived from the mark, opaque and correctly sized', async () => {
    const size = async (path: string) => {
      const bytes = new Uint8Array(await (await raw(path)).arrayBuffer());
      const view = new DataView(bytes.buffer);
      // PNG IHDR: width, height at 16/20; color type at 25 (2 = RGB, no alpha channel).
      return { width: view.getUint32(16), height: view.getUint32(20), colorType: bytes[25] };
    };
    expect(await size('/apple-touch-icon.png')).toEqual({ width: 180, height: 180, colorType: 2 });
    expect(await size('/icon-192.png')).toEqual({ width: 192, height: 192, colorType: 2 });
    expect(await size('/icon-512.png')).toEqual({ width: 512, height: 512, colorType: 2 });
    expect(await size('/icon-maskable-512.png')).toEqual({ width: 512, height: 512, colorType: 2 });
    const ico = new DataView(await (await raw('/favicon.ico')).arrayBuffer());
    expect(ico.getUint16(2, true)).toBe(1);
    expect(ico.getUint16(4, true)).toBe(2);
    expect([ico.getUint8(6), ico.getUint8(22)]).toEqual([16, 32]);
  });

  it('self-hosts the three OFL families as woff2 with font-display: swap', async () => {
    const css = await (await raw('/fonts.css')).text();
    for (const family of ['Newsreader', 'Plus Jakarta Sans', 'IBM Plex Mono'])
      expect(css).toContain(`font-family: '${family}'`);
    expect(css).not.toMatch(/https?:\/\//);
    expect(css).not.toMatch(/Inter|DynaPuff|Nunito/);
    expect(css.match(/font-display: swap/g)!.length).toBe(css.match(/@font-face/g)!.length);
    for (const url of css.match(/\/fonts\/[^']+\.woff2/g)!) {
      const font = await raw(url);
      expect(font.status).toBe(200);
      expect(new TextDecoder().decode((await font.arrayBuffer()).slice(0, 4))).toBe('wOF2');
    }
  });
});
