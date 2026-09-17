import { afterEach, describe, expect, it } from 'vitest';

import { ApiError } from '@/core/api/errors';
import { DUTRA_ROUTE, PLAN_QUERY_FIXTURE } from '@/test/fixtures';

import { useRouteStore } from './routeStore';

const INITIAL_STATE = useRouteStore.getState();

afterEach(() => {
  useRouteStore.setState(INITIAL_STATE, true);
});

describe('routeStore.restoreRoute', () => {
  it('puts routes/activeIndex/query in the same shape a real PlanRouteResponse would', () => {
    useRouteStore.getState().restoreRoute(DUTRA_ROUTE, PLAN_QUERY_FIXTURE);

    const state = useRouteStore.getState();
    expect(state.routes).toEqual([DUTRA_ROUTE]);
    expect(state.activeIndex).toBe(0);
    expect(state.query).toEqual(PLAN_QUERY_FIXTURE);
  });

  it('does not call the API and does not move status to loading', () => {
    useRouteStore.setState({ status: 'idle' });

    useRouteStore.getState().restoreRoute(DUTRA_ROUTE, PLAN_QUERY_FIXTURE);

    expect(useRouteStore.getState().status).toBe('idle');
  });

  it('leaves status/error untouched even when the store previously errored', () => {
    const error = new ApiError('unresolved-place', 422, 'not found', 'origin');
    useRouteStore.setState({ status: 'error', error });

    useRouteStore.getState().restoreRoute(DUTRA_ROUTE, PLAN_QUERY_FIXTURE);

    const state = useRouteStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe(error);
    // The restored route/query are still what the result screen needs to render,
    // regardless of what `status`/`error` say.
    expect(state.routes).toEqual([DUTRA_ROUTE]);
    expect(state.query).toEqual(PLAN_QUERY_FIXTURE);
  });
});
