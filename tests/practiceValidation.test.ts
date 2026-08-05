import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validatePracticeData } from '../artifacts/api-server/src/lib/practiceValidation.ts';

test('normalizes a valid generated MCQ set', () => {
  const result = validatePracticeData({
    mcqs: [{
      question: '  What is force? ',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 1,
      explanation: ' Because B is correct. ',
    }],
  }, ['mcq'], 1);

  assert.equal(result.mcqs?.[0].question, 'What is force?');
  assert.equal(result.mcqs?.[0].explanation, 'Because B is correct.');
});

test('rejects malformed generated practice instead of sending it to React', () => {
  assert.throws(
    () => validatePracticeData({ mcqs: [{ question: 'Q', options: ['A'], correctIndex: 9 }] }, ['mcq'], 1),
    /four options/,
  );
  assert.throws(
    () => validatePracticeData({ shortQuestions: [] }, ['short'], 2),
    /exactly 2 short questions/,
  );
});

test('requires generated questions to stay inside the selected targets', () => {
  assert.throws(
    () => validatePracticeData({
      definitions: [{ subject: 'Physics', chapter: 'Invented', term: 'Force', definition: 'A push or pull.' }],
    }, ['definition'], 1, [{ subject: 'Physics', chapter: 'Vectors' }]),
    /unselected target/,
  );
});
