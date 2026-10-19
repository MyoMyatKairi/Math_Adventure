import type { Page } from '@playwright/test';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export interface KeyedQuestion {
  id: string;
  question_type: string;
  prompt: string;
  options: { id: string; label: string }[] | null;
  answer_data: { value: string };
}

/** Test-only: reads answer keys straight from Postgres so the test can answer right or wrong on purpose. */
export async function answerKeys(lessonTitle: string): Promise<KeyedQuestion[]> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<KeyedQuestion>(
      `select q.id, q.question_type, q.prompt, q.options, q.answer_data
       from public.questions q join public.lessons l on l.id = q.lesson_id
       join public.worlds w on w.id = l.world_id
       where l.title = $1 and w.learning_level_id = '00000000-0000-4000-8000-000000000001'
       order by q.display_order`,
      [lessonTitle],
    );
    return rows;
  } finally {
    await client.end();
  }
}

function labelFor(q: KeyedQuestion, value: string): string {
  return q.options?.find((o) => o.id === value)?.label ?? value;
}

export function wrongValue(q: KeyedQuestion): string {
  if (q.question_type === 'compare') return q.answer_data.value === '<' ? '>' : '<';
  if (q.options?.length) return q.options.find((o) => o.id !== q.answer_data.value)!.id;
  return q.answer_data.value === '99' ? '98' : '99';
}

const COMPARE_NAMES: Record<string, string> = { '<': 'is less than', '>': 'is greater than', '=': 'is equal to' };

/** Enters an answer through the real UI controls for the question type. */
export async function enterAnswer(page: Page, q: KeyedQuestion, value: string) {
  if (q.question_type === 'compare') {
    await page.getByRole('radio', { name: COMPARE_NAMES[value]! }).click();
  } else if (q.options?.length) {
    await page.getByRole('radiogroup', { name: 'Answers' }).getByRole('radio', { name: labelFor(q, value), exact: true }).click();
  } else {
    await page.getByLabel('Your answer').fill(value);
  }
  await page.getByRole('button', { name: 'Check answer' }).click();
}
