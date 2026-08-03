import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  chapterDisplayName,
  isSubjectUrdu,
  subjectDisplayName,
} from '../artifacts/matric-study-planner/src/lib/subjectLanguage.ts';
import {
  getSubjectPersona,
  normalizeSubjectName,
} from '../artifacts/api-server/src/config/subjectPersonas.ts';

test('keeps Urdu rendering limited to the Urdu subject', () => {
  assert.equal(isSubjectUrdu('English'), false);
  assert.equal(isSubjectUrdu('Urdu'), true);
});

test('uses English rendering for selectable subjects', () => {
  assert.equal(isSubjectUrdu('Physics'), false);
  assert.equal(isSubjectUrdu('Islamiat'), false);
  assert.equal(isSubjectUrdu('Pakistan Studies'), false);
  assert.equal(isSubjectUrdu('Computer Science'), false);
});

test('shows subject names and selectable subject chapters in English', () => {
  assert.equal(subjectDisplayName('Physics'), 'Physics');
  assert.equal(chapterDisplayName('Physics', 'Measurements'), 'Measurements');
  assert.equal(subjectDisplayName('Mathematics'), 'Mathematics');
  assert.equal(chapterDisplayName('Mathematics', 'Logarithms'), 'Logarithms');
  assert.equal(subjectDisplayName('English'), 'English');
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

test('backend language follows only the matched subject persona', () => {
  assert.equal(getSubjectPersona('Physics').expectsUrduScript, false);
  assert.equal(getSubjectPersona('English').expectsUrduScript, false);
  assert.equal(getSubjectPersona('Urdu').expectsUrduScript, true);
});
