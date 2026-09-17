import { describe, expect, it } from 'vitest';

import {
  buildOverpassQuery,
  downloadOsmTollBoothNodes,
  OVERPASS_API_URL,
  OVERPASS_USER_AGENT,
} from '../src/overpass.js';

describe('buildOverpassQuery', () => {
  it('queries Brazil as an OSM area (not a manual bounding box), per orientation.md decision #6', () => {
    const query = buildOverpassQuery();
    expect(query).toContain('area["ISO3166-1"="BR"][admin_level=2]');
    expect(query).toContain('node["barrier"="toll_booth"](area.br)');
    // `out;`, not `out tags;` — the latter omits lat/lon for nodes, which
    // this job needs (confirmed against a real Overpass response).
    expect(query).toMatch(/out;\s*$/);
    expect(query).not.toContain('bbox');
  });

  it('embeds the given timeout', () => {
    expect(buildOverpassQuery(42)).toContain('[timeout:42]');
  });
});

describe('downloadOsmTollBoothNodes', () => {
  it('POSTs to the Overpass endpoint with a real User-Agent and the query as form data', async () => {
    let capturedUrl: string | undefined;
    let capturedInit: RequestInit | undefined;

    const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ elements: [] }), { status: 200 });
    }) as typeof fetch;

    const nodes = await downloadOsmTollBoothNodes(OVERPASS_API_URL, fakeFetch);

    expect(capturedUrl).toBe(OVERPASS_API_URL);
    expect(capturedInit?.method).toBe('POST');
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe(OVERPASS_USER_AGENT);
    expect(String(capturedInit?.body)).toContain(encodeURIComponent('barrier'));
    expect(nodes).toEqual([]);
  });

  it('returns only `node` elements, real-shaped (id/lat/lon/tags)', async () => {
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({
          elements: [
            { type: 'node', id: 1, lat: -23.5, lon: -46.6, tags: { barrier: 'toll_booth' } },
            { type: 'way', id: 2 },
          ],
        }),
        { status: 200 },
      )) as typeof fetch;

    const nodes = await downloadOsmTollBoothNodes(OVERPASS_API_URL, fakeFetch);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      type: 'node',
      id: 1,
      lat: -23.5,
      lon: -46.6,
      tags: { barrier: 'toll_booth' },
    });
  });

  it('throws a readable error on a non-2xx HTTP response', async () => {
    const fakeFetch = (async () =>
      new Response('boom', { status: 503, statusText: 'Service Unavailable' })) as typeof fetch;

    await expect(downloadOsmTollBoothNodes(OVERPASS_API_URL, fakeFetch)).rejects.toThrow(
      /HTTP 503/,
    );
  });

  it('throws a distinct, readable error when Overpass returns its HTML "server busy" page instead of JSON — a real finding to report, not to silently retry around', async () => {
    // The exact real response body observed from overpass-api.de under load
    // (2026-09-16/17) when the server is too busy to answer in time.
    const realBusyHtml = `<?xml version="1.0" encoding="UTF-8"?>
<html><body><p><strong>Error</strong>: runtime error: open64: 0 Success /osm3s_osm_base Dispatcher_Client::request_read_and_idx::timeout. The server is probably too busy to handle your request. </p></body></html>`;

    const fakeFetch = (async () => new Response(realBusyHtml, { status: 200 })) as typeof fetch;

    await expect(downloadOsmTollBoothNodes(OVERPASS_API_URL, fakeFetch)).rejects.toThrow(
      /busy|timeout/i,
    );
  });
});
