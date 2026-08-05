import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ONBOARDING_PROFILE_VERSION,
  createCompletedProfile,
  hasCompletedOnboarding,
  isValidExamDate,
  postAuthRoute,
} from '../artifacts/matric-study-planner/src/lib/onboardingProfile.ts';

const NOW = new Date('2026-08-04T12:00:00.000Z');

function completedProfile(overrides: Record<string, unknown> = {}) {
  return {
    board: 'Punjab Board',
    subjects: ['Physics'],
    examDate: '2027-03-15',
    onboardingComplete: true,
    onboardingCompletedAt: '2026-08-04T10:00:00.000Z',
    onboardingVersion: ONBOARDING_PROFILE_VERSION,
    ...overrides,
  };
}

test('routes only a genuinely completed profile to the dashboard', () => {
  const profile = completedProfile();

  assert.equal(hasCompletedOnboarding(profile, NOW), true);
  assert.equal(postAuthRoute(profile, NOW), '/dashboard');
});

test('does not trust the onboardingComplete flag or a profile-shaped default by itself', () => {
  const legacyDefault = {
    board: 'Punjab Board',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    examDate: '2027-03-15',
    onboardingComplete: true,
  };

  assert.equal(hasCompletedOnboarding(legacyDefault, NOW), false);
  assert.equal(postAuthRoute(legacyDefault, NOW), '/onboarding');
});

test('requires a recognized, non-placeholder board', () => {
  assert.equal(postAuthRoute(completedProfile({ board: '' }), NOW), '/onboarding');
  assert.equal(postAuthRoute(completedProfile({ board: 'Select a board' }), NOW), '/onboarding');
  assert.equal(postAuthRoute(completedProfile({ board: null }), NOW), '/onboarding');
});

test('requires at least one recognized selected subject', () => {
  assert.equal(postAuthRoute(completedProfile({ subjects: [] }), NOW), '/onboarding');
  assert.equal(
    postAuthRoute(completedProfile({ subjects: ['Placeholder Subject'] }), NOW),
    '/onboarding',
  );
  assert.equal(postAuthRoute(completedProfile({ subjects: null }), NOW), '/onboarding');
  assert.equal(postAuthRoute(completedProfile({ subjects: ['Physics'] }), NOW), '/dashboard');
});

test('rejects missing, malformed, and placeholder dates in a saved profile', () => {
  assert.equal(postAuthRoute(completedProfile({ examDate: '' }), NOW), '/onboarding');
  assert.equal(postAuthRoute(completedProfile({ examDate: 'not-a-date' }), NOW), '/onboarding');
  assert.equal(postAuthRoute(completedProfile({ examDate: '2027-02-31' }), NOW), '/onboarding');
  assert.equal(postAuthRoute(completedProfile({ examDate: '2099-12-31' }), NOW), '/onboarding');
});

test('keeps completed profiles available on and after exam day', () => {
  assert.equal(postAuthRoute(completedProfile({ examDate: '2026-08-04' }), NOW), '/dashboard');
  assert.equal(postAuthRoute(completedProfile({ examDate: '2026-07-01' }), NOW), '/dashboard');
});

test('still requires a future date when choosing a new exam date', () => {
  assert.equal(isValidExamDate('2026-08-04', NOW), false);
  assert.equal(isValidExamDate('2026-08-05', NOW), true);
  assert.equal(isValidExamDate('2099-12-31', NOW), false);
});

test('writes a completion receipt only when onboarding is submitted', () => {
  const profile = createCompletedProfile(
    {
      board: 'Federal Board',
      subjects: ['English', 'Mathematics'],
      examDate: '2027-04-01',
    },
    NOW,
  );

  assert.equal(profile.onboardingCompletedAt, NOW.toISOString());
  assert.equal(profile.onboardingVersion, ONBOARDING_PROFILE_VERSION);
  assert.equal(postAuthRoute(profile, NOW), '/dashboard');
});
