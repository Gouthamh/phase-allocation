import { expect, type APIRequestContext, type Page } from '@playwright/test';

export interface LoadInput {
  name?: string;
  current: number;
  cos: number;
  connection: 'L1' | 'L2' | 'L3' | 'L1-L2' | 'L2-L3' | 'L3-L1' | '3P';
  leading?: boolean;
}

interface Conductor {
  phase: string;
  current: number;
  angle: number;
  re: number;
  im: number;
  active: number;
  reactive: number;
}

export interface Calculation {
  phases: (Conductor & { phi: number; state: string })[];
  neutral_row: Conductor;
  ib: number;
  neutral: number;
  most_loaded: string | null;
  unbalance: number;
  arithmetic_sum: number;
}

export const initialLoads: LoadInput[] = [
  { current: 139, cos: 0.8, connection: 'L1' },
  { current: 130, cos: 1, connection: 'L2' },
  { current: 200, cos: 1, connection: 'L1-L2' },
];

export async function calculate(request: APIRequestContext, loads: LoadInput[]): Promise<Calculation> {
  const response = await request.post('/api/calculate', { data: { loads } });
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  const result: Calculation = await response.json();
  return result;
}

export function kpi(page: Page, label: string) {
  return page.getByRole('region', { name: 'Results' })
    .locator('.kpi')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('.value');
}

export function conductorRow(page: Page, phase: string) {
  return page.getByRole('region', { name: 'Results' }).getByRole('row')
    .filter({ has: page.getByRole('cell', { name: phase, exact: true }) });
}
