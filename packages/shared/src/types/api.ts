/** Shapes returned by the database RPCs (see supabase/migrations). */
import type { LearnerStats } from '../progression';
import type { AvatarKey } from '../schemas/forms';
import type { DailyGoalInfo, StreakInfo } from './index';

/** Badge stats plus total XP, as returned by private.learner_stats(). */
export interface LearnerStatsSummary extends LearnerStats {
  totalXp: number;
}

export interface ChildInfo {
  id: string;
  displayName: string;
  avatarKey: AvatarKey;
  ageGroup: '5-7' | '8-10' | '11-12';
  learningLevelId: string;
  levelName: string;
}

export interface MapLessonInfo {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  estimatedMinutes: number;
  displayOrder: number;
  topicTitle: string;
  status: 'not_started' | 'in_progress' | 'completed';
  bestStars: number;
  bestScore: number;
}

export interface WorldInfo {
  id: string;
  title: string;
  description: string;
  themeKey: string;
  displayOrder: number;
  unlocked: boolean;
  lessonCount: number;
  completedCount: number;
  lessonsToUnlockNext: number;
  lessons: MapLessonInfo[];
}

export interface BadgeInfo {
  key: string;
  title: string;
  description: string;
  iconKey: string;
  awardedAt: string | null;
}

export interface LearnerOverview {
  child: ChildInfo;
  stats: LearnerStatsSummary;
  streak: StreakInfo;
  dailyGoal: DailyGoalInfo;
  /** `mistakes`: questions last answered wrong on the first try. `available`: a practice round can start. */
  practice: { mistakes: number; available: boolean };
  worlds: WorldInfo[];
  daily: { lessonId: string; date: string; title: string; completed: boolean; bonusXp: number } | null;
  badges: BadgeInfo[];
  recentAchievements: (
    | { kind: 'badge'; title: string; iconKey: string; at: string }
    | { kind: 'lesson'; title: string; stars: number; score: number; at: string }
  )[];
}

export interface ChildReport {
  child: ChildInfo & { createdAt: string };
  stats: LearnerStatsSummary;
  levelLessonCount: number;
  topics: {
    topicId: string;
    topicTitle: string;
    questionsAnswered: number;
    firstTryCorrect: number;
    lessonsCompleted: number;
    lessonCount: number;
  }[];
  recentActivity: {
    attemptId: string;
    lessonTitle: string;
    topicTitle: string;
    score: number;
    stars: number;
    correctAnswers: number;
    totalQuestions: number;
    isDailyChallenge: boolean;
    completedAt: string;
  }[];
  weekly: { date: string; lessonsCompleted: number; questionsAnswered: number }[];
}

export interface ParentChildSummary extends ChildInfo {
  stats: LearnerStatsSummary;
  lastActiveAt: string | null;
}
