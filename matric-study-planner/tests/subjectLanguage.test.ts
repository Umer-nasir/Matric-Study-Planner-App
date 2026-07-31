import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canChooseSubjectLanguage,
  chapterDisplayName,
  defaultSubjectLanguage,
  getSubjectStudyLanguage,
  normalizeSubjectLanguages,
  subjectDisplayName,
} from '../artifacts/matric-study-planner/src/lib/subjectLanguage.ts';
import {
  getSubjectPersona,
  normalizeSubjectName,
} from '../artifacts/api-server/src/config/subjectPersonas.ts';

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

test('localizes display names only for Urdu-selected subjects', () => {
  const languages = {
    Physics: 'urdu',
    Mathematics: 'english',
  } as const;

  assert.equal(subjectDisplayName('Physics', languages), 'طبیعیات');
  assert.equal(chapterDisplayName('Physics', 'Measurements', languages), 'پیمائش');
  assert.equal(subjectDisplayName('Mathematics', languages), 'Mathematics');
  assert.equal(chapterDisplayName('Mathematics', 'Logarithms', languages), 'Logarithms');
});

test('matches subject personas exactly after trim and lowercase normalization', () => {
  assert.equal(normalizeSubjectName('  Physics  '), 'physics');
  assert.equal(getSubjectPersona('  uRdU  ').key, 'Urdu');
  assert.equal(getSubjectPersona('english').key, 'English');
  assert.equal(getSubjectPersona(' Pakistan Studies ').key, 'Pakistan Studies');
  assert.equal(getSubjectPersona('Islamiat').key, 'Islamiat');
});

test('does not bleed personas through partial or unmatched subject names', () => {
  assert.equal(getSubjectPersona('Physics').key, 'Default');
  assert.equal(getSubjectPersona('Urdu Literature').key, 'Default');
  assert.equal(getSubjectPersona('Pre-Islamiat').key, 'Default');
  assert.equal(getSubjectPersona(undefined).key, 'Default');
  assert.equal(getSubjectPersona('Physics').expectsUrduScript, false);
  assert.equal(getSubjectPersona('Urdu').expectsUrduScript, true);
});

test('allows explicit Urdu study language without changing the subject persona match', () => {
  const physicsInUrdu = getSubjectPersona('Physics', 'urdu');
  assert.equal(physicsInUrdu.key, 'Default');
  assert.equal(physicsInUrdu.expectsUrduScript, true);

  assert.equal(getSubjectPersona('English', 'urdu').expectsUrduScript, false);
  assert.equal(getSubjectPersona('Urdu', 'english').expectsUrduScript, true);
});
