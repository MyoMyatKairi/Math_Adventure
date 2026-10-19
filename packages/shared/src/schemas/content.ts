import { z } from 'zod';

export const AGE_GROUPS = ['5-7', '8-10', '11-12'] as const;
export const ageGroupSchema = z.enum(AGE_GROUPS);

export const QUESTION_TYPES = [
  'multiple_choice',
  'numeric',
  'missing_number',
  'compare',
  'pattern',
  'visual_quantity',
] as const;
export const questionTypeSchema = z.enum(QUESTION_TYPES);

/** How a numeric answer must be written. `any` accepts every equal value. */
export const ANSWER_FORMATS = ['any', 'decimal', 'fraction', 'simplest_fraction'] as const;
export const answerFormatSchema = z.enum(ANSWER_FORMATS);

export const COMPARE_SYMBOLS = ['<', '>', '='] as const;

export const OBJECT_KEYS = [
  'apple',
  'star',
  'ball',
  'fish',
  'leaf',
  'block',
  'shell',
  'balloon',
  'cookie',
  'flower',
] as const;
export const objectKeySchema = z.enum(OBJECT_KEYS);

export const SHAPE_KEYS = [
  'circle',
  'square',
  'triangle',
  'rectangle',
  'pentagon',
  'hexagon',
  'oval',
  'star',
] as const;
export const shapeKeySchema = z.enum(SHAPE_KEYS);

const finite = z.number().finite();
const smallInt = z.number().int().min(0).max(1000);

/** A number written as text so fractions ("3/4") survive JSON exactly. */
const numberText = z.string().regex(/^-?\d+(\.\d+)?(\/\d+)?$/);

export const visualDataSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('objects'),
    object: objectKeySchema,
    groups: z.array(z.number().int().min(0).max(20)).min(1).max(4),
    crossedOut: z.number().int().min(0).max(20).optional(),
  }),
  z.object({
    kind: z.literal('number_line'),
    min: finite,
    max: finite,
    step: finite.positive(),
    highlight: z.array(finite).max(4).optional(),
    jumps: z.array(z.object({ from: finite, to: finite })).max(12).optional(),
  }),
  z.object({ kind: z.literal('shape'), shape: shapeKeySchema }),
  z.object({
    kind: z.literal('shape_sequence'),
    items: z.array(shapeKeySchema.nullable()).min(3).max(10),
  }),
  z.object({
    kind: z.literal('fraction_bar'),
    parts: z.number().int().min(1).max(12),
    shaded: z.number().int().min(0).max(12),
  }),
  z.object({
    kind: z.literal('clock'),
    hour: z.number().int().min(1).max(12),
    minute: z.number().int().min(0).max(59),
  }),
  z.object({
    kind: z.literal('coins'),
    coins: z.array(z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(25), z.literal(100)])).min(1).max(12),
  }),
  z.object({
    kind: z.literal('base_ten'),
    hundreds: z.number().int().min(0).max(9),
    tens: z.number().int().min(0).max(9),
    ones: z.number().int().min(0).max(9),
  }),
  z.object({
    kind: z.literal('array'),
    rows: z.number().int().min(1).max(12),
    cols: z.number().int().min(1).max(12),
    object: objectKeySchema,
  }),
  z.object({
    kind: z.literal('equation'),
    /** Numbers, operators, or null for the blank to fill in. */
    parts: z.array(z.union([numberText, z.enum(['+', '-', '×', '÷', '=']), z.null()])).min(3).max(9),
  }),
  z.object({
    kind: z.literal('sequence'),
    items: z.array(finite.nullable()).min(3).max(10),
  }),
  z.object({
    kind: z.literal('compare'),
    left: numberText,
    right: numberText,
    object: objectKeySchema.optional(),
  }),
  z.object({
    kind: z.literal('rectangle'),
    width: smallInt,
    height: smallInt,
    unit: z.enum(['cm', 'm', 'units']),
    showGrid: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('triangle'),
    base: smallInt,
    height: smallInt,
    unit: z.enum(['cm', 'm', 'units']),
  }),
  z.object({
    kind: z.literal('ruler'),
    length: z.number().int().min(1).max(15),
    object: z.enum(['pencil', 'crayon', 'ribbon', 'worm']),
  }),
  z.object({ kind: z.literal('percent_grid'), shaded: z.number().int().min(0).max(100) }),
  z.object({
    kind: z.literal('ratio'),
    a: z.object({ object: objectKeySchema, count: z.number().int().min(0).max(20) }),
    b: z.object({ object: objectKeySchema, count: z.number().int().min(0).max(20) }),
  }),
  z.object({ kind: z.literal('thermometer'), value: z.number().int().min(-30).max(40) }),
]);
export type VisualData = z.infer<typeof visualDataSchema>;

export const questionOptionSchema = z.object({
  id: z.string().min(1).max(12),
  label: z.string().min(1).max(60),
  visual: visualDataSchema.optional(),
});
export type QuestionOption = z.infer<typeof questionOptionSchema>;

/** Expected answer. Kept server-side only; never sent to a learner before they answer. */
export const answerDataSchema = z.object({
  value: z.string().min(1).max(40),
  format: answerFormatSchema.optional(),
});
export type AnswerData = z.infer<typeof answerDataSchema>;

export const difficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const questionDraftSchema = z.object({
  type: questionTypeSchema,
  prompt: z.string().min(3).max(240),
  visual: visualDataSchema.optional(),
  options: z.array(questionOptionSchema).min(2).max(6).optional(),
  answer: answerDataSchema,
  explanation: z.string().min(10).max(500),
  hint: z.string().min(3).max(200).optional(),
  difficulty: difficultySchema,
  points: z.number().int().min(1).max(50),
});
export type QuestionDraft = z.infer<typeof questionDraftSchema>;

export const SECTION_TYPES = ['introduction', 'worked_example', 'practice', 'summary'] as const;
export const sectionTypeSchema = z.enum(SECTION_TYPES);

export const sectionContentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('introduction'),
    text: z.string().min(3).max(300),
    visual: visualDataSchema.optional(),
  }),
  z.object({
    kind: z.literal('worked_example'),
    problem: z.string().min(3).max(200),
    steps: z.array(z.string().min(2).max(200)).min(1).max(6),
    visual: visualDataSchema.optional(),
  }),
  z.object({ kind: z.literal('practice'), text: z.string().min(3).max(200) }),
  z.object({
    kind: z.literal('summary'),
    points: z.array(z.string().min(2).max(160)).min(1).max(5),
  }),
]);
export type SectionContent = z.infer<typeof sectionContentSchema>;

/** Question as delivered to a learner: no answer, no explanation. */
export const publicQuestionSchema = z.object({
  id: z.string().uuid(),
  type: questionTypeSchema,
  prompt: z.string(),
  visual: visualDataSchema.nullable(),
  options: z.array(questionOptionSchema).nullable(),
  hint: z.string().nullable(),
  answerFormat: answerFormatSchema,
  difficulty: z.number().int(),
  points: z.number().int(),
});
export type PublicQuestion = z.infer<typeof publicQuestionSchema>;
