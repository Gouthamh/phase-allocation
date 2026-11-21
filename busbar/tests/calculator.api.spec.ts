import { test, expect } from '@playwright/test';
import { calculate, initialLoads, type LoadInput } from './helpers';

test.describe('API regression', { tag: '@regression' }, () => {
  test('gateway health is available', { tag: '@smoke' }, async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  test('default calculation preserves the response contract and known result',
    { tag: '@smoke' }, async ({ request }) => {
      const result = await calculate(request, initialLoads);
      const conductor = {
        phase: expect.any(String), current: expect.any(Number), angle: expect.any(Number),
        re: expect.any(Number), im: expect.any(Number), active: expect.any(Number),
        reactive: expect.any(Number),
      };
      expect(result).toMatchObject({
        phases: [1, 2, 3].map((phase) => ({
          ...conductor, phase: `Ph${phase}`, phi: expect.any(Number), state: expect.any(String),
        })),
        neutral_row: { ...conductor, phase: 'N' },
        ib: expect.any(Number), neutral: expect.any(Number), most_loaded: 'Ph2',
        unbalance: expect.any(Number), arithmetic_sum: 469,
      });
      expect(result.phases).toHaveLength(3);
      expect(Math.abs(result.phases[0].current - 284.9)).toBeLessThan(0.1);
      expect(Math.abs(result.phases[1].current - 319.3)).toBeLessThan(0.1);
      expect(result.phases[2].current).toBe(0);
      expect(Math.abs(result.ib - 319.3)).toBeLessThan(0.1);
      expect(Math.abs(result.neutral - 201.4)).toBeLessThan(0.1);
      expect(result.unbalance).toBe(100);
    });

  test('invalid power factor returns a JSON validation error', { tag: '@smoke' }, async ({ request }) => {
    const response = await request.post('/api/calculate', {
      data: { loads: [{ current: 10, cos: 0, connection: 'L1' }] },
    });
    expect(response.status()).toBe(422);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toMatchObject({
      detail: expect.arrayContaining([
        expect.objectContaining({ loc: ['body', 'loads', 0, 'cos'], msg: expect.any(String) }),
      ]),
    });
  });

  const connections: { connection: LoadInput['connection']; currents: number[]; neutral: number }[] = [
    { connection: 'L1', currents: [100, 0, 0], neutral: 100 },
    { connection: 'L2', currents: [0, 100, 0], neutral: 100 },
    { connection: 'L3', currents: [0, 0, 100], neutral: 100 },
    { connection: 'L1-L2', currents: [100, 100, 0], neutral: 0 },
    { connection: 'L2-L3', currents: [0, 100, 100], neutral: 0 },
    { connection: 'L3-L1', currents: [100, 0, 100], neutral: 0 },
    { connection: '3P', currents: [100, 100, 100], neutral: 0 },
  ];
  for (const scenario of connections) {
    test(`${scenario.connection} distributes current to the correct conductors`, async ({ request }) => {
      const result = await calculate(request, [{ current: 100, cos: 1, connection: scenario.connection }]);
      expect(result.phases.map((phase) => phase.current)).toEqual(scenario.currents);
      expect(result.neutral).toBeCloseTo(scenario.neutral, 6);
      expect(result.ib).toBeCloseTo(100, 6);
      expect(result.arithmetic_sum).toBe(100);
    });
  }

  test('leading and lagging loads have opposite reactive currents', async ({ request }) => {
    const load: LoadInput = { current: 100, cos: 0.8, connection: 'L1' };
    const lagging = await calculate(request, [load]);
    const leading = await calculate(request, [{ ...load, leading: true }]);
    expect(lagging.phases[0]).toMatchObject({ state: 'lagging' });
    expect(leading.phases[0]).toMatchObject({ state: 'leading' });
    expect(lagging.phases[0].active).toBeCloseTo(80, 6);
    expect(leading.phases[0].active).toBeCloseTo(80, 6);
    expect(lagging.phases[0].reactive).toBeCloseTo(-60, 6);
    expect(leading.phases[0].reactive).toBeCloseTo(60, 6);
    expect(leading.phases[0].angle).toBeCloseTo(-lagging.phases[0].angle, 6);
  });

  test('opposite reactive loads cancel their reactive component', async ({ request }) => {
    const load: LoadInput = { current: 100, cos: 0.8, connection: 'L1' };
    const result = await calculate(request, [load, { ...load, leading: true }]);
    expect(result.ib).toBeCloseTo(160, 6);
    expect(result.neutral).toBeCloseTo(160, 6);
    expect(result.phases[0].reactive).toBeCloseTo(0, 6);
    expect(result.phases[0].state).toBe('unity');
    expect(result.arithmetic_sum).toBe(200);
  });

  test('maximum supported current, name length, and load count are accepted', async ({ request }) => {
    const loads: LoadInput[] = Array.from({ length: 100 }, () => ({
      name: 'a'.repeat(50), current: 1_000_000, cos: 1, connection: 'L1',
    }));
    const result = await calculate(request, loads);
    expect(result.ib).toBe(100_000_000);
    expect(result.arithmetic_sum).toBe(100_000_000);
  });

  const invalidRequests = [
    { name: 'empty loads', body: { loads: [] } },
    { name: 'too many loads', body: { loads: Array.from({ length: 101 }, () => initialLoads[0]) } },
    { name: 'zero current', body: { loads: [{ current: 0, cos: 1, connection: 'L1' }] } },
    { name: 'negative current', body: { loads: [{ current: -1, cos: 1, connection: 'L1' }] } },
    { name: 'excessive current', body: { loads: [{ current: 1_000_001, cos: 1, connection: 'L1' }] } },
    { name: 'power factor above one', body: { loads: [{ current: 10, cos: 1.01, connection: 'L1' }] } },
    { name: 'unknown connection', body: { loads: [{ current: 10, cos: 1, connection: 'L4' }] } },
    { name: 'missing current', body: { loads: [{ cos: 1, connection: 'L1' }] } },
    { name: 'long name', body: { loads: [{ ...initialLoads[0], name: 'a'.repeat(51) }] } },
  ];
  for (const scenario of invalidRequests) {
    test(`rejects ${scenario.name}`, async ({ request }) => {
      const response = await request.post('/api/calculate', { data: scenario.body });
      expect(response.status()).toBe(422);
      expect(await response.json()).toMatchObject({ detail: expect.any(Array) });
    });
  }

  test('malformed JSON is rejected', async ({ request }) => {
    const response = await request.post('/api/calculate', {
      data: '{"loads":', headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(422);
    expect(await response.json()).toMatchObject({ detail: expect.any(Array) });
  });

  for (const path of ['/api', '/api/nonexistent']) {
    test(`unknown API route ${path} remains JSON rather than SPA HTML`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(404);
      expect(response.headers()['content-type']).toContain('application/json');
      expect(await response.json()).toEqual({ detail: 'Not Found' });
    });
  }

  test('missing frontend assets return 404 rather than index HTML', async ({ request }) => {
    const response = await request.get('/assets/nonexistent.js');
    expect(response.status()).toBe(404);
  });
});
