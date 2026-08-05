import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeScheduleDates } from '../artifacts/api-server/src/lib/scheduleDates.ts';

test('starts AI schedules on the local date supplied by the browser', () => {
  const result = normalizeScheduleDates(
    {
      week: Array.from({ length: 7 }, () => ({ blocks: [] })),
    },
    '2026-08-05',
  );

  assert.deepEqual(
    result.week?.map((day) => {
      const value = day as { day: string; date: string };
      return [value.day, value.date];
    }),
    [
      ['Wednesday', '2026-08-05'],
      ['Thursday', '2026-08-06'],
      ['Friday', '2026-08-07'],
      ['Saturday', '2026-08-08'],
      ['Sunday', '2026-08-09'],
      ['Monday', '2026-08-10'],
      ['Tuesday', '2026-08-11'],
    ],
  );
});

test('rejects invalid local schedule dates', () => {
  assert.throws(
    () => normalizeScheduleDates({ week: [] }, '2026-02-31'),
    /Invalid local start date/,
  );
});

test('rejects malformed AI days and blocks before they reach the UI', () => {
  assert.throws(
    () => normalizeScheduleDates({ week: [{ blocks: 'not-an-array' }] }, '2026-08-05'),
    /exactly seven days/,
  );

  const week = Array.from({ length: 7 }, () => ({ blocks: [] as unknown[] }));
  week[0].blocks = [{ subject: 'Physics', chapter: 'Vectors', durationMinutes: 'forever' }];
  assert.throws(() => normalizeScheduleDates({ week }, '2026-08-05'), /Invalid study block/);
});

test('rejects chapters that were not selected by the student', () => {
  const week = Array.from({ length: 7 }, () => ({ blocks: [] as unknown[] }));
  week[0].blocks = [{ subject: 'Physics', chapter: 'Hallucinated Chapter', durationMinutes: 45 }];

  assert.throws(
    () => normalizeScheduleDates({ week }, '2026-08-05', { Physics: ['Vectors'] }),
    /unselected chapter/,
  );
});
