import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  parseTutorSubjectClassification,
  sanitizeAvailableTutorSubjects,
} from '../artifacts/api-server/src/config/tutorSubjectClassification.ts';

test('allows only known, unique subjects from the student profile', () => {
  assert.deepEqual(
    sanitizeAvailableTutorSubjects([
      'Physics',
      'Computer Science',
      'Physics',
      'General',
      'Made Up Subject',
      null,
    ]),
    ['Physics', 'Computer Science'],
  );
  assert.deepEqual(sanitizeAvailableTutorSubjects('Physics'), []);
});

test('accepts exact AI classifications in common safe formats', () => {
  const available = ['Physics', 'Computer Science', 'Urdu'];
  assert.equal(parseTutorSubjectClassification('Computer Science', available), 'Computer Science');
  assert.equal(parseTutorSubjectClassification('subject: physics', available), 'Physics');
  assert.equal(parseTutorSubjectClassification('{"subject":"Urdu"}', available), 'Urdu');
  assert.equal(parseTutorSubjectClassification('```text\nPhysics\n```', available), 'Physics');
  assert.equal(parseTutorSubjectClassification('General', available), 'General');
});

test('falls back to General for unavailable, ambiguous, or unsafe AI output', () => {
  const available = ['Physics', 'Chemistry'];
  assert.equal(parseTutorSubjectClassification('Biology', available), 'General');
  assert.equal(parseTutorSubjectClassification('Physics or Chemistry', available), 'General');
  assert.equal(parseTutorSubjectClassification('Physics because the question mentions force', available), 'General');
  assert.equal(parseTutorSubjectClassification('', available), 'General');
});
