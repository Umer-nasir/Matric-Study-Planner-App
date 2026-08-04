import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SUBJECTS } from '../artifacts/matric-study-planner/src/data/syllabus.ts';
import { buildTutorSubjectOptions } from '../artifacts/matric-study-planner/src/lib/tutorSubjectOptions.ts';

test('offers every Matric subject to the AI tutor', () => {
  const options = buildTutorSubjectOptions(['Biology', 'Mathematics']);

  assert.deepEqual(options.slice(0, 3), ['General', 'Biology', 'Mathematics']);
  assert.deepEqual(new Set(options.slice(1)), new Set(SUBJECTS));
  assert.equal(options.includes('Computer Science'), true);
});

test('ignores unknown and duplicate saved subjects', () => {
  const options = buildTutorSubjectOptions(['Biology', 'Unknown', 'Biology']);

  assert.equal(options.filter((subject) => subject === 'Biology').length, 1);
  assert.equal(options.includes('Unknown'), false);
});
