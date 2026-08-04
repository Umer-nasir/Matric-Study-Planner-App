import assert from 'node:assert/strict';
import { test } from 'node:test';

import { detectTutorSubject } from '../artifacts/matric-study-planner/src/lib/tutorSubjectDetection.ts';

const SUBJECTS = [
  'Physics',
  'Chemistry',
  'Mathematics',
  'Biology',
  'Computer Science',
  'English',
  'Urdu',
  'Islamiat',
  'Pakistan Studies',
];

test('detects common Computer Science concepts that are not chapter titles', () => {
  assert.equal(detectTutorSubject('what is a memory?', SUBJECTS), 'Computer Science');
  assert.equal(detectTutorSubject('Explain RAM and ROM', SUBJECTS), 'Computer Science');
  assert.equal(detectTutorSubject('What does a CPU do?', SUBJECTS), 'Computer Science');
  assert.equal(detectTutorSubject('What is computer hardware?', SUBJECTS), 'Computer Science');
});

test('continues detecting subjects from exact syllabus chapters', () => {
  assert.equal(detectTutorSubject('Explain current electricity', SUBJECTS), 'Physics');
  assert.equal(detectTutorSubject('Help me understand chemical bonding', SUBJECTS), 'Chemistry');
  assert.equal(detectTutorSubject('Teach me logarithms', SUBJECTS), 'Mathematics');
});

test('detects common topics across every selectable subject', () => {
  const cases: Array<[string, string]> = [
    ['Why does gravity pull objects down?', 'Physics'],
    ['How do acids react with bases?', 'Chemistry'],
    ['How do I solve a linear equation?', 'Mathematics'],
    ['How does photosynthesis work?', 'Biology'],
    ['What is computer memory?', 'Computer Science'],
    ['Change this sentence into passive voice', 'English'],
    ['What is a ghazal?', 'Urdu'],
    ['Why is zakat important?', 'Islamiat'],
    ['What was the Pakistan Movement?', 'Pakistan Studies'],
  ];

  for (const [question, subject] of cases) {
    assert.equal(detectTutorSubject(question, SUBJECTS), subject, question);
  }
});

test('detects Urdu-script questions for the relevant subjects', () => {
  assert.equal(detectTutorSubject('غزل کی تشریح کریں', SUBJECTS), 'Urdu');
  assert.equal(detectTutorSubject('زکوٰۃ کی اہمیت کیا ہے؟', SUBJECTS), 'Islamiat');
  assert.equal(detectTutorSubject('تحریک پاکستان کیا تھی؟', SUBJECTS), 'Pakistan Studies');
});

test('prefers an exact chapter over a weaker topic keyword', () => {
  assert.equal(
    detectTutorSubject('Explain chemical bonding and its energy changes', SUBJECTS),
    'Chemistry',
  );
});

test('does not guess when different subjects have equally strong signals', () => {
  assert.equal(detectTutorSubject('What is cell memory?', SUBJECTS), null);
});

test('only selects subjects available in the student profile', () => {
  assert.equal(detectTutorSubject('what is computer memory?', ['Physics', 'Chemistry']), null);
  assert.equal(detectTutorSubject('How does photosynthesis work?', ['Physics', 'Chemistry']), null);
  assert.equal(detectTutorSubject('How should I study today?', SUBJECTS), null);
});
