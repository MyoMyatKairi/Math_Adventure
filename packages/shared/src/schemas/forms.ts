import { z } from 'zod';
import type { Locale } from '../i18n/locales';
import { isMessageKey, translate } from '../i18n/translate';
import { ageGroupSchema } from './content';

export const AVATAR_KEYS = ['fox', 'owl', 'panda', 'turtle', 'rocket', 'robot', 'whale', 'lion'] as const;
export const avatarKeySchema = z.enum(AVATAR_KEYS);
export type AvatarKey = z.infer<typeof avatarKeySchema>;

/** Learning levels are seeded with fixed ids so clients and tests can reference them. */
export const LEARNING_LEVELS = [
  { id: '00000000-0000-4000-8000-000000000001', key: 'level_1', name: 'Level 1', minimumAge: 5, maximumAge: 7, ageGroup: '5-7' },
  { id: '00000000-0000-4000-8000-000000000002', key: 'level_2', name: 'Level 2', minimumAge: 8, maximumAge: 10, ageGroup: '8-10' },
  { id: '00000000-0000-4000-8000-000000000003', key: 'level_3', name: 'Level 3', minimumAge: 11, maximumAge: 12, ageGroup: '11-12' },
] as const;
export type LearningLevelInfo = (typeof LEARNING_LEVELS)[number];

export function levelForAgeGroup(ageGroup: (typeof LEARNING_LEVELS)[number]['ageGroup']): LearningLevelInfo {
  const level = LEARNING_LEVELS.find((l) => l.ageGroup === ageGroup);
  if (!level) throw new Error(`Unknown age group ${ageGroup}`);
  return level;
}

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'form.nameRequired')
  .max(30, 'form.nameTooLong')
  // Letters (any script), spaces, apostrophes and hyphens only — a nickname, not a legal name.
  .regex(/^[\p{L}\p{M}' -]+$/u, 'form.nameChars');

export const childProfileInputSchema = z.object({
  displayName: displayNameSchema,
  avatarKey: avatarKeySchema,
  ageGroup: ageGroupSchema,
  learningLevelId: z.string().uuid(),
});
export type ChildProfileInput = z.infer<typeof childProfileInputSchema>;

export const emailSchema = z.string().trim().toLowerCase().email('form.emailInvalid').max(254);
export const passwordSchema = z
  .string()
  .min(8, 'form.passwordShort')
  .max(72, 'form.passwordLong')
  .regex(/[A-Za-z]/, 'form.passwordLetter')
  .regex(/[0-9]/, 'form.passwordNumber');

export const signUpSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'form.passwordRequired') });
export const resetRequestSchema = z.object({ email: emailSchema });
export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'form.passwordMismatch', path: ['confirm'] });

/** Raw learner input sent to the server. Parsing happens in the math engine. */
export const answerSubmissionSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  value: z.string().max(40),
});
export type AnswerSubmission = z.infer<typeof answerSubmissionSchema>;

/**
 * Collects the first message per field, for form display. Schema messages are
 * catalog keys (e.g. `form.nameRequired`); they are translated here, and any
 * other Zod message falls back to a generic one.
 */
export function fieldErrors(error: z.ZodError, locale: Locale = 'en'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = translate(locale, isMessageKey(issue.message) ? issue.message : 'form.invalid');
  }
  return out;
}
