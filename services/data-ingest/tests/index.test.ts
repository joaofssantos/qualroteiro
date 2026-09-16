import { describe, expect, it } from 'vitest';

import { ping } from '../src/index.js';

describe('@qualroteiro/data-ingest scaffold', () => {
  it('smoke test: exports a working sanity check', () => {
    expect(ping()).toBe('pong');
  });
});
