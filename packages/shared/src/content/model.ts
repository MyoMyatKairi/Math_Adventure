import { TRANSLATED_LOCALES, type TranslatedLocale } from '../i18n/locales';
import type { QuestionDraft, SectionContent, VisualData } from '../schemas/content';
import { GENERATORS, type GeneratedQuestion, type GeneratorName, type GeneratorParams, type QuestionText } from '../math/generators';
import { createRng, hashSeed } from '../math/rng';
import type { ContentTranslation, LessonText } from './translation';
import { validateQuestion, validateTranslations } from './validate';

// ---------------------------------------------------------------------------
// Authoring model
// ---------------------------------------------------------------------------

export type QuestionSpec =
  | { [N in GeneratorName]: { gen: N; params?: GeneratorParams<N> } }[GeneratorName]
  | { literal: GeneratedQuestion; difficulty?: 1 | 2 | 3 };

export interface LessonDef {
  key: string;
  world: string;
  title: string;
  description: string;
  objective: string;
  difficulty: 1 | 2 | 3;
  minutes: number;
  intro: string;
  introVisual?: VisualData;
  example: { problem: string; steps: string[]; visual?: VisualData };
  summary: string[];
  questions: QuestionSpec[];
}

export interface TopicDef {
  key: string;
  title: string;
  description: string;
  lessons: LessonDef[];
}

export interface WorldDef {
  key: string;
  title: string;
  description: string;
  themeKey: string;
}

export interface LevelDef {
  levelId: string;
  worlds: WorldDef[];
  topics: TopicDef[];
}

export function gen<N extends GeneratorName>(name: N, params?: GeneratorParams<N>): QuestionSpec {
  return { gen: name, params } as QuestionSpec;
}

export function literal(q: GeneratedQuestion, difficulty?: 1 | 2 | 3): QuestionSpec {
  return { literal: q, difficulty };
}

// ---------------------------------------------------------------------------
// Built (seedable) model
// ---------------------------------------------------------------------------

/** Per-language text for a content row, stored in its `translations` jsonb column. */
export type Translations<T> = Record<TranslatedLocale, T>;

export interface BuiltQuestion extends QuestionDraft {
  id: string;
  displayOrder: number;
  translations: Translations<QuestionText>;
}

export interface BuiltSection {
  id: string;
  type: SectionContent['kind'];
  title: string;
  content: SectionContent;
  displayOrder: number;
  translations: Translations<{ title: string; content: SectionContent }>;
}

export interface BuiltLesson {
  id: string;
  key: string;
  worldId: string;
  topicId: string;
  title: string;
  description: string;
  objective: string;
  difficulty: 1 | 2 | 3;
  minutes: number;
  displayOrder: number;
  sections: BuiltSection[];
  questions: BuiltQuestion[];
  translations: Translations<{ title: string; description: string; learning_objective: string }>;
}

type TitleText = { title: string; description: string };

export interface BuiltCurriculum {
  worlds: { id: string; key: string; levelId: string; title: string; description: string; themeKey: string; displayOrder: number; translations: Translations<TitleText> }[];
  topics: { id: string; key: string; levelId: string; title: string; description: string; displayOrder: number; translations: Translations<TitleText> }[];
  lessons: BuiltLesson[];
}

/** Stable UUID (version 4 layout) derived from a content key, so re-seeding updates rows in place. */
export function contentId(key: string): string {
  const hex = [0, 1, 2, 3].map((salt) => hashSeed(`${salt}:${key}`).toString(16).padStart(8, '0')).join('');
  const chars = hex.split('');
  chars[12] = '4';
  chars[16] = '89ab'[parseInt(chars[16]!, 16) % 4]!;
  const s = chars.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

const MAX_REGENERATE = 25;

const ENGLISH_SECTIONS: ContentTranslation['sections'] = {
  learn: "Let's learn",
  example: 'Worked example',
  practice: 'Your turn',
  remember: 'Remember',
  practiceText: (n) => `Try ${n} questions. You get two tries at each one.`,
};

type Draft = QuestionDraft & Pick<GeneratedQuestion, 'i18n'>;

function generate(spec: QuestionSpec, lesson: LessonDef, index: number, seen: Set<string>): Draft {
  if ('literal' in spec) {
    return { ...spec.literal, difficulty: spec.difficulty ?? lesson.difficulty, points: 10 };
  }
  const fn = GENERATORS[spec.gen] as (rng: ReturnType<typeof createRng>, p: unknown) => GeneratedQuestion;
  for (let round = 0; round < MAX_REGENERATE; round++) {
    const q = fn(createRng(`${lesson.key}:${index}:${round}`), spec.params ?? {});
    const optionLabels = q.options?.map((o) => o.label).sort() ?? null;
    const signature = `${q.prompt}|${JSON.stringify(q.visual ?? null)}|${JSON.stringify(optionLabels)}`;
    if (!seen.has(signature)) {
      seen.add(signature);
      return { ...q, difficulty: lesson.difficulty, points: 10 };
    }
  }
  throw new Error(`Could not generate a unique question ${index} for ${lesson.key}`);
}

/** Looks up a key in every translation, failing the build if any language is missing it. */
function each<T>(translations: Translations<ContentTranslation>, pick: (t: ContentTranslation) => T | undefined, what: string): Translations<T> {
  return Object.fromEntries(
    TRANSLATED_LOCALES.map((l) => {
      const v = pick(translations[l]);
      if (v === undefined) throw new Error(`Missing ${l} translation for ${what}`);
      return [l, v];
    }),
  ) as Translations<T>;
}

/** Translated lesson text, checked to have the same number of steps and summary points as the English. */
function lessonText(translations: Translations<ContentTranslation>, l: LessonDef): Translations<LessonText> {
  const text = each(translations, (t) => t.lessons[l.key], `lesson ${l.key}`);
  for (const loc of TRANSLATED_LOCALES) {
    const t = text[loc];
    if (t.example.steps.length !== l.example.steps.length) throw new Error(`${loc} ${l.key}: example has ${t.example.steps.length} steps, English has ${l.example.steps.length}`);
    if (t.summary.length !== l.summary.length) throw new Error(`${loc} ${l.key}: summary has ${t.summary.length} points, English has ${l.summary.length}`);
  }
  return text;
}

export function buildCurriculum(levels: LevelDef[], translations: Translations<ContentTranslation>): BuiltCurriculum {
  const out: BuiltCurriculum = { worlds: [], topics: [], lessons: [] };
  const usedKeys = new Set<string>();
  const claim = (key: string) => {
    if (usedKeys.has(key)) throw new Error(`Duplicate content key ${key}`);
    usedKeys.add(key);
    return contentId(key);
  };

  for (const level of levels) {
    const worldIds = new Map<string, string>();
    level.worlds.forEach((w, i) => {
      const id = claim(`world:${w.key}`);
      worldIds.set(w.key, id);
      out.worlds.push({
        id, key: w.key, levelId: level.levelId, title: w.title, description: w.description, themeKey: w.themeKey, displayOrder: i + 1,
        translations: each(translations, (t) => t.worlds[w.key], `world ${w.key}`),
      });
    });
    const orderInWorld = new Map<string, number>();
    level.topics.forEach((t, ti) => {
      const topicId = claim(`topic:${t.key}`);
      out.topics.push({
        id: topicId, key: t.key, levelId: level.levelId, title: t.title, description: t.description, displayOrder: ti + 1,
        translations: each(translations, (tr) => tr.topics[t.key], `topic ${t.key}`),
      });
      for (const l of t.lessons) {
        const worldId = worldIds.get(l.world);
        if (!worldId) throw new Error(`Lesson ${l.key} references unknown world ${l.world}`);
        const displayOrder = (orderInWorld.get(l.world) ?? 0) + 1;
        orderInWorld.set(l.world, displayOrder);
        const lessonId = claim(`lesson:${l.key}`);
        const text = lessonText(translations, l);
        const sectionsFor = (s: ContentTranslation['sections'], t: Pick<LessonText, 'intro' | 'example' | 'summary'>) =>
          [
            { title: s.learn, content: { kind: 'introduction', text: t.intro, ...(l.introVisual ? { visual: l.introVisual } : {}) } },
            { title: s.example, content: { kind: 'worked_example', ...t.example, ...(l.example.visual ? { visual: l.example.visual } : {}) } },
            { title: s.practice, content: { kind: 'practice', text: s.practiceText(l.questions.length) } },
            { title: s.remember, content: { kind: 'summary', points: t.summary } },
          ] satisfies { title: string; content: SectionContent }[];
        const sectionContents = sectionsFor(ENGLISH_SECTIONS, l);
        const translatedSections = Object.fromEntries(
          TRANSLATED_LOCALES.map((loc) => [loc, sectionsFor(translations[loc].sections, text[loc])]),
        ) as Translations<{ title: string; content: SectionContent }[]>;
        const seen = new Set<string>();
        const questions = l.questions.map((spec, qi) => {
          const { i18n, ...draft } = generate(spec, l, qi, seen);
          const qText = 'literal' in spec ? each(translations, (t) => t.lessons[l.key]?.literals?.[qi], `question ${qi} of ${l.key}`) : i18n;
          const problems = [...validateQuestion(draft), ...validateTranslations(draft, qText)];
          if (problems.length > 0) {
            throw new Error(`Invalid question ${qi} in ${l.key}: ${problems.join('; ')}\n${JSON.stringify({ ...draft, i18n: qText }, null, 2)}`);
          }
          return { ...draft, id: claim(`question:${l.key}:${qi}`), displayOrder: qi + 1, translations: qText as Translations<QuestionText> };
        });
        out.lessons.push({
          id: lessonId,
          key: l.key,
          worldId,
          topicId,
          title: l.title,
          description: l.description,
          objective: l.objective,
          difficulty: l.difficulty,
          minutes: l.minutes,
          displayOrder,
          sections: sectionContents.map((s, si) => ({
            id: claim(`section:${l.key}:${si}`),
            type: s.content.kind,
            title: s.title,
            content: s.content,
            displayOrder: si + 1,
            translations: Object.fromEntries(TRANSLATED_LOCALES.map((loc) => [loc, translatedSections[loc][si]!])) as BuiltSection['translations'],
          })),
          questions,
          translations: Object.fromEntries(
            TRANSLATED_LOCALES.map((loc) => [loc, { title: text[loc].title, description: text[loc].description, learning_objective: text[loc].objective }]),
          ) as BuiltLesson['translations'],
        });
      }
    });
  }
  return out;
}
