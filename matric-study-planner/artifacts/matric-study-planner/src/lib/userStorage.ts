export const GUEST_DATA_OWNER = 'guest';

export const USER_DATA_STORAGE_KEYS = [
  'matric_profile',
  'matric_chapters',
  'matric_schedule_selection_configured',
  'matric_streak',
  'matric_badges',
  'matric_ai_schedule',
  'tutorChatHistory',
  'matric_practice_history',
  'matric_events',
  'matric_reminder_settings',
  'matric_definition_checks',
] as const;

export type UserDataStorageKey = (typeof USER_DATA_STORAGE_KEYS)[number];

export function getUserDataOwner(
  googleUid: string | null | undefined,
  isGuest: boolean,
): string | null {
  if (googleUid) return `google:${googleUid}`;
  return isGuest ? GUEST_DATA_OWNER : null;
}

export function userDataStorageKey(owner: string, key: UserDataStorageKey): string {
  return `matric_user_data:${encodeURIComponent(owner)}:${key}`;
}
