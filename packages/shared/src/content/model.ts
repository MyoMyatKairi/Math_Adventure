import type { QuestionDraft, SectionContent, VisualData } from '../schemas/content';
import { GENERATORS, type GeneratedQuestion, type GeneratorName, type GeneratorParams } from '../math/generators';
import { createRng, hashSeed } from '../math/rng';
import { validateQuestion } from './validate';

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

export interface BuiltQuestion extends QuestionDraft {
  id: string;
  displayOrder: number;
}

export interface BuiltSection {
  id: string;
  type: SectionContent['kind'];
  title: string;
  content: SectionContent;
  displayOrder: number;
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
}

export interface BuiltCurriculum {
  worlds: { id: string; key: string; levelId: string; title: string; description: string; themeKey: string; displayOrder: number }[];
  topics: { id: string; key: string; levelId: string; title: string; description: string; displayOrder: number }[];
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

function generate(spec: QuestionSpec, lesson: LessonDef, index: number, seen: Set<string>): QuestionDraft {
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

export function buildCurriculum(levels: LevelDef[]): BuiltCurriculum {
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
      out.worlds.push({ id, key: w.key, levelId: level.levelId, title: w.title, description: w.description, themeKey: w.themeKey, displayOrder: i + 1 });
    });
    const orderInWorld = new Map<string, number>();
    level.topics.forEach((t, ti) => {
      const topicId = claim(`topic:${t.key}`);
      out.topics.push({ id: topicId, key: t.key, levelId: level.levelId, title: t.title, description: t.description, displayOrder: ti + 1 });
      for (const l of t.lessons) {
        const worldId = worldIds.get(l.world);
        if (!worldId) throw new Error(`Lesson ${l.key} references unknown world ${l.world}`);
        const displayOrder = (orderInWorld.get(l.world) ?? 0) + 1;
        orderInWorld.set(l.world, displayOrder);
        const lessonId = claim(`lesson:${l.key}`);
        const sectionContents: { title: string; content: SectionContent }[] = [
          { title: "Let's learn", content: { kind: 'introduction', text: l.intro, ...(l.introVisual ? { visual: l.introVisual } : {}) } },
          { title: 'Worked example', content: { kind: 'worked_example', ...l.example } },
          { title: 'Your turn', content: { kind: 'practice', text: `Try ${l.questions.length} questions. You get two tries at each one.` } },
          { title: 'Remember', content: { kind: 'summary', points: l.summary } },
        ];
        const seen = new Set<string>();
        const questions = l.questions.map((spec, qi) => {
          const draft = generate(spec, l, qi, seen);
          const problems = validateQuestion(draft);
          if (problems.length > 0) {
            throw new Error(`Invalid question ${qi} in ${l.key}: ${problems.join('; ')}\n${JSON.stringify(draft, null, 2)}`);
          }
          return { ...draft, id: claim(`question:${l.key}:${qi}`), displayOrder: qi + 1 };
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
          })),
          questions,
        });
      }
    });
  }
  return out;
}
