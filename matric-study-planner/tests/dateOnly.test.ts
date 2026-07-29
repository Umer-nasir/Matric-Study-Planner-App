import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

import {
  dateInputValueToExamDate,
  dateOnlyToLocalDate,
  daysUntilDateOnly,
  examDateToLocalDate,
  toDateInputValue,
} from '../artifacts/matric-study-planner/src/lib/dateOnly.ts';

test('stores exam dates as date-only values from date inputs', () => {
  assert.equal(dateInputValueToExamDate('2026-03-01'), '2026-03-01');
});

test('reads legacy ISO exam dates by their date-only prefix', () => {
  assert.equal(toDateInputValue('2026-03-01T00:00:00.000Z'), '2026-03-01');
  assert.equal(toDateInputValue('2026-03-01'), '2026-03-01');
});

test('parses date-only exam dates as local calendar dates', () => {
  const date = dateOnlyToLocalDate('2026-03-01');

  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 2);
  assert.equal(date.getDate(), 1);
});

test('computes days left using calendar days, not UTC offsets', () => {
  const now = new Date(2026, 1, 28, 23, 30, 0, 0);

  assert.equal(daysUntilDateOnly('2026-03-01', now), 1);
});

test('keeps date-only values stable in a negative timezone', () => {
  const script = [
    "import { examDateToLocalDate, toDateInputValue } from './artifacts/matric-study-planner/src/lib/dateOnly.ts';",
    "const date = examDateToLocalDate('2026-03-01T00:00:00.000Z');",
    "console.log(JSON.stringify({ input: toDateInputValue('2026-03-01T00:00:00.000Z'), day: date.getDate() }));",
  ].join('');

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    env: { ...process.env, TZ: 'America/Los_Angeles' },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { input: '2026-03-01', day: 1 });
});
