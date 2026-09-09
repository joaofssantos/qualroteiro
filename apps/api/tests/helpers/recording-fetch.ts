/**
 * A typed `fetch` stub that records what it was called with.
 *
 * Preferred over `vi.fn()` here because the adapters take `fetchImpl` as a real
 * `typeof fetch`, and asserting on `vi.fn().mock.calls` under
 * `noUncheckedIndexedAccess` needs a cast at every access site. This keeps the
 * assertions readable and fully typed.
 */

export interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit;
}

export interface RecordingFetch {
  /** Pass to an adapter's `fetchImpl`. */
  readonly impl: typeof fetch;
  readonly calls: RecordedCall[];
  /** The nth recorded call, asserting it happened. */
  call(index: number): RecordedCall;
  /** The nth call's JSON-parsed request body. */
  body(index: number): Record<string, unknown>;
}

/**
 * Build a recording fetch.
 *
 * @param responses one factory per expected call; the last is reused if the
 * adapter calls more times than there are entries.
 */
export function recordingFetch(...responses: Array<() => Response>): RecordingFetch {
  const calls: RecordedCall[] = [];

  const impl = async (input: unknown, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} });
    const factory = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (factory === undefined) {
      throw new Error('recordingFetch: no response configured');
    }
    return factory();
  };

  const at = (index: number): RecordedCall => {
    const call = calls[index];
    if (call === undefined) {
      throw new Error(`recordingFetch: expected a call at index ${index}, got ${calls.length}`);
    }
    return call;
  };

  return {
    impl: impl as unknown as typeof fetch,
    calls,
    call: at,
    body(index: number): Record<string, unknown> {
      const raw = at(index).init.body;
      if (typeof raw !== 'string') {
        throw new Error(`recordingFetch: call ${index} had no string body`);
      }
      return JSON.parse(raw) as Record<string, unknown>;
    },
  };
}

/** A JSON `Response`, as the adapters expect to receive. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
