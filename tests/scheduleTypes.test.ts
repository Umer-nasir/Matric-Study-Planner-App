import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeAiSchedule } from '../artifacts/matric-study-planner/src/types/schedule.ts';

test('rejects corrupt saved schedules before dashboard rendering', () => {
  assert.equal(normalizeAiSchedule({ week: [{ day: 'Monday', date: '2026-08-05', blocks: 'bad' }] }), null);
  assert.equal(normalizeAiSchedule({ week: [] }), null);
});

test('normalizes safe saved schedule values', () => {
  const schedule = normalizeAiSchedule({
    generatedAt: '2026-08-05T10:00:00.000Z',
    week: [{
      day: 'Wednesday',
      date: '2026-08-05',
      blocks: [{ subject: 'Physics', chapter: 'Vectors', durationMinutes: 999 }],
    }],
  });

  assert.equal(schedule?.week[0].blocks[0].durationMinutes, 180);
  assert.equal(schedule?.generatedAt, '2026-08-05T10:00:00.000Z');
});
