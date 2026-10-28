import type { z } from 'zod';
import type {
  AGE_GROUPS,
  ANSWER_FORMATS,
  QUESTION_TYPES,
  SECTION_TYPES,
  questionDraftSchema,
  sectionContentSchema,
} from '../schemas/content';

export type AgeGroup = (typeof AGE_GROUPS)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type AnswerFormat = (typeof ANSWER_FORMATS)[number];
export type SectionType = (typeof SECTION_TYPES)[number];

export type { PublicQuestion, QuestionOption, VisualData, AnswerData, SectionContent } from '../schemas/content';
export type QuestionDraftInput = z.input<typeof questionDraftSchema>;
export type SectionContentInput = z.input<typeof sectionContentSchema>;

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

/** Shapes returned by the server RPCs (see supabase/migrations). */
export interface StartLessonResult {
  attemptId: string;
  resumed: boolean;
  isDailyChallenge: boolean;
  lesson: {
    id: string;
    title: string;
    description: string;
    learningObjective: string;
    difficulty: number;
    estimatedMinutes: number;
    worldTitle: string;
    topicTitle: string;
  };
  sections: { id: string; type: SectionType; title: string; content: import('../schemas/content').SectionContent }[];
  questions: import('../schemas/content').PublicQuestion[];
  progress: QuestionProgress[];
}

export interface QuestionProgress {
  questionId: string;
  tries: number;
  resolved: boolean;
  correct: boolean;
  pointsAwarded: number;
}

export type SubmitAnswerResult =
  | { status: 'invalid'; reason: string; message: string }
  | {
      status: 'answered';
      isCorrect: boolean;
      attemptNumber: number;
      triesRemaining: number;
      resolved: boolean;
      pointsAwarded: number;
      hint: string | null;
      explanation: string | null;
      correctAnswer: string | null;
    };

/** Returned by `start_review`: a practice round of earlier mistakes, with no lesson. */
export interface StartReviewResult {
  attemptId: string;
  resumed: boolean;
  kind: 'review';
  questions: import('../schemas/content').PublicQuestion[];
  progress: QuestionProgress[];
}

export interface StreakInfo {
  current: number;
  longest: number;
  freezes: number;
  practicedToday: boolean;
  /** The last 7 UTC days, oldest first. */
  week: { date: string; active: boolean }[];
}

export interface DailyGoalInfo {
  target: number;
  done: number;
}

export interface CompleteLessonResult {
  attemptId: string;
  kind: 'lesson' | 'review';
  /** Null for practice rounds. */
  lessonId: string | null;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  stars: number;
  bestStars: number;
  xpAwarded: number;
  starsAwarded: number;
  isDailyChallenge: boolean;
  dailyBonusXp: number;
  newBadges: { key: string; title: string; description: string; iconKey: string }[];
  unlockedWorlds: { id: string; title: string }[];
  alreadyCompleted: boolean;
  streak: StreakInfo & { extended: boolean; freezesUsed: number; freezeEarned: boolean };
  dailyGoal: DailyGoalInfo;
}
