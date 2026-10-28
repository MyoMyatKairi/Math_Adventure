'use client';

import type { PublicQuestion, QuestionType } from '@math-adventure/shared';
import { Delete } from 'lucide-react';
import type { ComponentType } from 'react';
import { useT } from '@/components/i18n';
import { Visual } from '@/components/visuals/visual';
import { cn } from '@/lib/utils';

export interface AnswerInputProps {
  question: PublicQuestion;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  /** Learner's level: younger learners get a simpler keypad. */
  ageGroup: '5-7' | '8-10' | '11-12';
}

/**
 * Question-type registry. Adding a new question type means adding one entry
 * here (and its checker in packages/shared + the SQL mirror); the lesson
 * player never changes.
 */
export const ANSWER_INPUTS: Record<QuestionType, ComponentType<AnswerInputProps>> = {
  multiple_choice: ChoiceInput,
  numeric: NumberInput,
  missing_number: NumberInput,
  pattern: NumberInput,
  compare: CompareInput,
  visual_quantity: (props) => (props.question.options?.length ? <ChoiceInput {...props} /> : <NumberInput {...props} />),
};

function ChoiceInput({ question, value, onChange, disabled }: AnswerInputProps) {
  const t = useT();
  const options = question.options ?? [];
  const numeric = options.every((o) => /^-?\d+$/.test(o.label));
  return (
    <div role="radiogroup" aria-label={t('input.answers')} className={cn('grid gap-3', numeric ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2')}>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={cn(
              'flex min-h-16 items-center justify-center gap-3 rounded-2xl border-[3px] px-4 py-3 font-display text-xl font-bold transition-colors disabled:cursor-not-allowed',
              numeric && 'text-3xl tabular',
              selected ? 'border-plum bg-plum-soft text-plum-dark' : 'border-line bg-paper hover:border-ink-soft',
            )}
          >
            {o.visual && <Visual visual={o.visual} size="sm" className="w-12" />}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const SYMBOLS = [
  { value: '<', name: 'input.lessThan' },
  { value: '=', name: 'input.equalTo' },
  { value: '>', name: 'input.greaterThan' },
] as const;

function CompareInput({ value, onChange, disabled }: AnswerInputProps) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t('input.compareSign')} className="flex justify-center gap-3">
      {SYMBOLS.map((s) => (
        <button
          key={s.value}
          type="button"
          role="radio"
          aria-checked={value === s.value}
          aria-label={t(s.name)}
          disabled={disabled}
          onClick={() => onChange(s.value)}
          className={cn(
            'h-20 w-20 rounded-3xl border-[3px] font-display text-5xl font-extrabold transition-colors',
            value === s.value ? 'border-plum bg-plum-soft text-plum-dark' : 'border-line bg-paper hover:border-ink-soft',
          )}
        >
          {s.value}
        </button>
      ))}
    </div>
  );
}

function NumberInput({ question, value, onChange, onSubmit, disabled, ageGroup }: AnswerInputProps) {
  const t = useT();
  const format = question.answerFormat;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const extras =
    ageGroup === '5-7' ? ['0'] : format === 'fraction' || format === 'simplest_fraction' ? ['-', '0', '/'] : ['-', '0', '.'];
  const press = (k: string) => {
    if (disabled || value.length >= 20) return;
    onChange(value + k);
  };
  const placeholder =
    format === 'decimal' ? t('input.placeholderDecimal') : format === 'fraction' || format === 'simplest_fraction' ? t('input.placeholderFraction') : t('input.yourAnswer');
  return (
    <div className="mx-auto w-full max-w-xs">
      <label htmlFor="answer" className="sr-only">
        {t('input.yourAnswer')}
      </label>
      <input
        id="answer"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 32))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
        inputMode={format === 'fraction' || format === 'simplest_fraction' ? 'text' : 'decimal'}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        className="h-16 w-full rounded-2xl border-[3px] border-line bg-paper text-center font-display text-4xl font-extrabold tabular placeholder:text-xl placeholder:font-semibold placeholder:text-ink-soft/50 focus:border-plum focus:outline-none"
      />
      <div className="mt-3 grid grid-cols-3 gap-2" aria-label={t('input.numberPad')}>
        {[...keys, ...extras].map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => press(k)}
            className={cn(
              'h-14 rounded-2xl bg-paper font-display text-2xl font-extrabold shadow-[0_3px_0_0_var(--color-line)] active:translate-y-[2px] active:shadow-none disabled:opacity-50',
              ageGroup === '5-7' && k === '0' && 'col-start-2',
            )}
            aria-label={k === '-' ? t('input.minus') : k === '.' ? t('input.decimalPoint') : k === '/' ? t('input.fractionBar') : k}
          >
            {k === '-' ? '−' : k}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={() => onChange(value.slice(0, -1))}
          className="col-start-3 flex h-14 items-center justify-center rounded-2xl bg-chalk text-ink-soft disabled:opacity-40"
          aria-label={t('input.delete')}
        >
          <Delete className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
