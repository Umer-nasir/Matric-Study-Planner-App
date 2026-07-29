import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canChooseSubjectLanguage,
  defaultSubjectLanguage,
  getSubjectStudyLanguage,
  normalizeSubjectLanguages,
} from '../artifacts/matric-study-planner/src/lib/subjectLanguage.ts';

test('keeps English and Urdu subjects fixed to their own response languages', () => {
  assert.equal(canChooseSubjectLanguage('English'), false);
  assert.equal(canChooseSubjectLanguage('Urdu'), false);
  assert.equal(getSubjectStudyLanguage('English', { English: 'urdu' }), 'english');
  assert.equal(getSubjectStudyLanguage('Urdu', { Urdu: 'english' }), 'urdu');
});

test('preserves mixed language preferences for selectable subjects', () => {
  const subjects = ['Physics', 'Islamiat', 'Pakistan Studies', 'Computer Science'];
  const normalized = normalizeSubjectLanguages(subjects, {
    Physics: 'urdu',
    'Computer Science': 'english',
  });

  assert.deepEqual(normalized, {
    Physics: 'urdu',
    Islamiat: 'urdu',
    'Pakistan Studies': 'urdu',
    'Computer Science': 'english',
  });
  assert.equal(getSubjectStudyLanguage('Physics', normalized), 'urdu');
  assert.equal(getSubjectStudyLanguage('Computer Science', normalized), 'english');
});

test('uses subject defaults when a preference is missing', () => {
  assert.equal(defaultSubjectLanguage('Physics'), 'english');
  assert.equal(defaultSubjectLanguage('Islamiat'), 'urdu');
  assert.equal(getSubjectStudyLanguage('Chemistry', {}), 'english');
});
