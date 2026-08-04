import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getUserDataOwner,
  userDataStorageKey,
} from '../artifacts/matric-study-planner/src/lib/userStorage.ts';
import {
  createCompletedProfile,
  postAuthRoute,
} from '../artifacts/matric-study-planner/src/lib/onboardingProfile.ts';

test('uses stable and distinct owners for Guest and each Google UID', () => {
  assert.equal(getUserDataOwner(null, false), null);
  assert.equal(getUserDataOwner(null, true), 'guest');
  assert.equal(getUserDataOwner('google-user-a', true), 'google:google-user-a');
  assert.equal(getUserDataOwner('google-user-b', false), 'google:google-user-b');
});

test('scopes the same study-data key to separate identities', () => {
  const guestKey = userDataStorageKey('guest', 'matric_profile');
  const googleAKey = userDataStorageKey('google:google-user-a', 'matric_profile');
  const googleBKey = userDataStorageKey('google:google-user-b', 'matric_profile');

  assert.notEqual(guestKey, googleAKey);
  assert.notEqual(googleAKey, googleBKey);
  assert.notEqual(guestKey, 'matric_profile');
});

test('switching identities reads only that identity profile', () => {
  const storage = new Map<string, string>();
  const guestKey = userDataStorageKey('guest', 'matric_profile');
  const googleKey = userDataStorageKey('google:google-user-a', 'matric_profile');

  storage.set(guestKey, JSON.stringify({ board: 'Punjab Board' }));
  assert.equal(storage.get(googleKey), undefined);

  storage.set(googleKey, JSON.stringify({ board: 'Federal Board' }));
  assert.deepEqual(JSON.parse(storage.get(guestKey)!), {
    board: 'Punjab Board',
  });
  assert.deepEqual(JSON.parse(storage.get(googleKey)!), {
    board: 'Federal Board',
  });
});

test('new, returning, and switched identities get the correct onboarding route', () => {
  const now = new Date('2026-08-04T12:00:00.000Z');
  const storage = new Map<string, string>();
  const guestOwner = getUserDataOwner(null, true)!;
  const googleOwner = getUserDataOwner('google-user-a', false)!;
  const guestProfileKey = userDataStorageKey(guestOwner, 'matric_profile');
  const googleProfileKey = userDataStorageKey(googleOwner, 'matric_profile');

  assert.equal(postAuthRoute(storage.get(guestProfileKey), now), '/onboarding');
  assert.equal(postAuthRoute(storage.get(googleProfileKey), now), '/onboarding');

  const googleProfile = createCompletedProfile(
    {
      board: 'Federal Board',
      subjects: ['Mathematics'],
      examDate: '2027-04-01',
    },
    now,
  );
  storage.set(googleProfileKey, JSON.stringify(googleProfile));

  assert.equal(postAuthRoute(JSON.parse(storage.get(googleProfileKey)!), now), '/dashboard');
  assert.equal(postAuthRoute(storage.get(guestProfileKey), now), '/onboarding');

  const sameGoogleOwnerAfterSignIn = getUserDataOwner('google-user-a', false)!;
  assert.equal(
    userDataStorageKey(sameGoogleOwnerAfterSignIn, 'matric_profile'),
    googleProfileKey,
  );
});
