import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  parseTaggedTutorReply,
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
  assert.deepEqual(
    sanitizeAvailableTutorSubjects('["Biology","Computer Science","Biology"]'),
    ['Biology', 'Computer Science'],
  );
  assert.deepEqual(sanitizeAvailableTutorSubjects('not-json'), []);
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

test('keeps the AI-selected subject and metadata out of the visible answer', () => {
  assert.deepEqual(
    parseTaggedTutorReply(
      '[[SUBJECT: Computer Science]]\nRAM is temporary working memory.',
      ['Computer Science', 'Biology'],
      'General',
    ),
    {
      reply: 'RAM is temporary working memory.',
      subject: 'Computer Science',
    },
  );
});

test('preserves manual selection and safely handles missing or invalid tags', () => {
  assert.equal(
    parseTaggedTutorReply(
      '[[SUBJECT: Biology]]\nA manually focused answer.',
      ['Computer Science', 'Biology'],
      'Computer Science',
    ).subject,
    'Computer Science',
  );
  assert.deepEqual(
    parseTaggedTutorReply('A normal untagged answer.', ['Biology'], 'General'),
    { reply: 'A normal untagged answer.', subject: 'General' },
  );
  assert.equal(
    parseTaggedTutorReply('[[SUBJECT: Chemistry]]\nAnswer.', ['Biology'], 'General').subject,
    'General',
  );
});
