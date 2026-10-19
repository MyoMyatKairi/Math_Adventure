/** Turns server error keys into plain guidance. Never shows raw database errors to children. */
const MESSAGES: Record<string, string> = {
  not_authenticated: 'Your session has ended. Please sign in again.',
  child_not_found: 'That learner profile is not available.',
  lesson_not_available: 'This lesson is not part of the current level.',
  world_locked: 'Finish more lessons in the world before this one to open it.',
  not_daily_challenge: "This isn't today's challenge.",
  rate_limited: "That's a lot of lessons in one hour! Take a break and come back soon.",
  lesson_has_no_questions: 'This lesson is not ready yet.',
  attempt_not_found: 'We could not find that lesson session. Start the lesson again.',
  attempt_closed: 'This lesson session has finished. Start the lesson again to keep practising.',
  question_not_in_attempt: 'That question is not part of this lesson.',
  question_already_answered: 'You have already answered this one.',
  attempt_incomplete: 'Answer every question before finishing.',
  child_limit_reached: 'You can have up to 8 learner profiles.',
};

export function friendlyError(error: { message?: string } | null | undefined): string {
  const msg = error?.message ?? '';
  for (const [key, text] of Object.entries(MESSAGES)) if (msg.includes(key)) return text;
  if (/fetch|network/i.test(msg)) return 'We could not reach the server. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}
