import type { QuestionText } from '../math/generators';

/** A lesson's authored text in one translated language. Arrays match the English item for item. */
export interface LessonText {
  title: string;
  description: string;
  objective: string;
  intro: string;
  example: { problem: string; steps: string[] };
  summary: string[];
  /** Hand-written (literal) questions, by their index in the lesson's question list. */
  literals?: Record<number, QuestionText>;
}

/** All curriculum text for one translated language, keyed by content key. */
export interface ContentTranslation {
  sections: { learn: string; example: string; practice: string; remember: string; practiceText: (questions: number) => string };
  worlds: Record<string, { title: string; description: string }>;
  topics: Record<string, { title: string; description: string }>;
  lessons: Record<string, LessonText>;
}
