import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getTimeGreeting } from '../artifacts/matric-study-planner/src/lib/timeGreeting.ts';

function localTime(hour: number): Date {
  return new Date(2026, 7, 5, hour, 0, 0, 0);
}

test('uses a night greeting after 7 PM and before 5 AM', () => {
  assert.equal(getTimeGreeting(localTime(19)), 'Good night');
  assert.equal(getTimeGreeting(localTime(23)), 'Good night');
  assert.equal(getTimeGreeting(localTime(0)), 'Good night');
  assert.equal(getTimeGreeting(localTime(4)), 'Good night');
});

test('uses morning, afternoon, and evening greetings during the day', () => {
  assert.equal(getTimeGreeting(localTime(5)), 'Good morning');
  assert.equal(getTimeGreeting(localTime(11)), 'Good morning');
  assert.equal(getTimeGreeting(localTime(12)), 'Good afternoon');
  assert.equal(getTimeGreeting(localTime(16)), 'Good afternoon');
  assert.equal(getTimeGreeting(localTime(17)), 'Good evening');
  assert.equal(getTimeGreeting(localTime(18)), 'Good evening');
});
