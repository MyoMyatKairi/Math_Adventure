import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { answerKeys, enterAnswer, wrongValue } from './helpers';

test('parent signs up, adds a child, child completes a lesson, progress persists', async ({ page }) => {
  const email = `e2e-${randomUUID()}@example.test`;
  const password = 'Adventure123';

  // 1. Register (local Supabase auto-confirms email).
  await page.goto('/');
  await page.getByRole('link', { name: 'Create a free parent account' }).click();
  await page.getByLabel('Your first name').fill('Jordan');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Hi, Jordan' })).toBeVisible();

  // Sign out and back in.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('wrong-password-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('That email and password don’t match an account.')).toBeVisible();
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Add your first learner' })).toBeVisible();

  // 2–3. Create a child profile with a learning level; validation first.
  await page.getByRole('link', { name: 'Add learner' }).click();
  await page.getByRole('button', { name: 'Add learner' }).click();
  await expect(page.getByText('Please enter a name.')).toBeVisible();
  await page.getByLabel('Nickname').fill('Sky');
  await page.getByRole('radio', { name: 'Owl' }).click();
  await page.getByRole('radio', { name: /Level 1/ }).click();
  await page.getByRole('button', { name: 'Add learner' }).click();
  await expect(page.getByText('Sky is ready to start learning.')).toBeVisible();

  // 4. Child opens an available lesson.
  await page.getByRole('button', { name: 'Start learning' }).click();
  await expect(page.getByRole('heading', { name: 'Your adventure starts here' })).toBeVisible();
  await page.getByRole('link', { name: 'Start my first lesson' }).click();
  await expect(page.getByRole('heading', { name: 'Count to 10' })).toBeVisible();
  await page.getByRole('button', { name: 'Show me an example' }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByRole('button', { name: 'Start practice' }).click();

  // 5–6. Wrong then right on Q1 (hint + retry feedback), right on the rest.
  const keys = await answerKeys('Count to 10');
  expect(keys).toHaveLength(5);
  for (const [i, q] of keys.entries()) {
    await expect(page.getByRole('heading', { name: q.prompt })).toBeVisible();
    if (i === 0) {
      await enterAnswer(page, q, wrongValue(q));
      await expect(page.getByText('Not quite. Have another go!')).toBeVisible();
      await expect(page.getByText(/^Hint:/)).toBeVisible();
    }
    await enterAnswer(page, q, q.answer_data.value);
    await expect(page.getByText(i === 0 ? 'You got it!' : 'Correct!')).toBeVisible();
    await page.getByRole('button', { name: i === keys.length - 1 ? 'Finish lesson' : 'Next question' }).click();
  }

  // 7–8. Completion with rewards: 45/50 = 90% → 3 stars, 20 XP + 15 star XP.
  await expect(page.getByRole('heading', { name: 'Brilliant work!' })).toBeVisible();
  await expect(page.getByText('4 of 5 right first time, score 90%')).toBeVisible();
  await expect(page.getByText('+35')).toBeVisible();
  await expect(page.getByText('First Steps')).toBeVisible();

  // Learner home reflects it.
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Ready for the next lesson?' })).toBeVisible();
  await expect(page.getByLabel('3 stars', { exact: true })).toBeVisible();

  // 9. Parent area is locked behind the password; the dashboard shows progress.
  await page.getByRole('link', { name: 'Grown-ups' }).click();
  await expect(page.getByRole('heading', { name: 'Grown-ups only' })).toBeVisible();
  await page.getByLabel('Parent password').fill('nope-nope-1');
  await page.getByRole('button', { name: 'Open parent area' }).click();
  await expect(page.getByText('That password isn’t right.')).toBeVisible();
  await page.getByLabel('Parent password').fill(password);
  await page.getByRole('button', { name: 'Open parent area' }).click();
  await page.getByRole('link', { name: 'View progress' }).click();
  await expect(page.getByRole('heading', { name: 'Sky' })).toBeVisible();
  await expect(page.getByText('80%', { exact: true })).toBeVisible();
  await expect(page.getByText('Count to 10', { exact: true })).toBeVisible();

  // 10. Reload preserves everything.
  await page.reload();
  await expect(page.getByText('80%', { exact: true })).toBeVisible();
  await expect(page.getByText('Count to 10', { exact: true })).toBeVisible();
});

test('signed-out visitors are sent to sign in', async ({ page }) => {
  await page.goto('/parent');
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto('/learn/home');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('landing page works on a phone @mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A maths adventure for ages 5 to 12' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
