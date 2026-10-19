import type { PublicQuestion } from '@math-adventure/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ANSWER_INPUTS } from './answer-inputs';
import { firstUnresolved } from './lesson-player';

const base: Omit<PublicQuestion, 'type'> = {
  id: '00000000-0000-4000-8000-0000000000aa',
  prompt: 'Q',
  visual: null,
  options: null,
  hint: null,
  answerFormat: 'any',
  difficulty: 1,
  points: 10,
};

function Harness({ q, onSubmit = () => {} }: { q: PublicQuestion; onSubmit?: () => void }) {
  const [v, setV] = useState('');
  const Input = ANSWER_INPUTS[q.type];
  return (
    <>
      <Input question={q} value={v} onChange={setV} onSubmit={onSubmit} disabled={false} ageGroup="11-12" />
      <output data-testid="value">{v}</output>
    </>
  );
}

describe('answer inputs', () => {
  it('has a renderer for every question type', () => {
    expect(Object.keys(ANSWER_INPUTS).sort()).toEqual(['compare', 'missing_number', 'multiple_choice', 'numeric', 'pattern', 'visual_quantity']);
  });

  it('keypad and keyboard both edit the answer; Enter submits', () => {
    let submitted = 0;
    render(<Harness q={{ ...base, type: 'numeric', answerFormat: 'decimal' }} onSubmit={() => submitted++} />);
    fireEvent.click(screen.getByRole('button', { name: 'minus' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: 'decimal point' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getByTestId('value')).toHaveTextContent('-3.5');
    fireEvent.click(screen.getByRole('button', { name: 'Delete last character' }));
    expect(screen.getByTestId('value')).toHaveTextContent('-3.');
    fireEvent.keyDown(screen.getByLabelText('Your answer'), { key: 'Enter' });
    expect(submitted).toBe(1);
  });

  it('multiple choice behaves as a radio group', () => {
    render(<Harness q={{ ...base, type: 'multiple_choice', options: [{ id: 'a', label: '1/2' }, { id: 'b', label: '1/3' }] }} />);
    fireEvent.click(screen.getByRole('radio', { name: '1/3' }));
    expect(screen.getByRole('radio', { name: '1/3' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('value')).toHaveTextContent('b');
  });

  it('visual quantity with options shows number choices', () => {
    render(<Harness q={{ ...base, type: 'visual_quantity', options: [{ id: '4', label: '4' }, { id: '5', label: '5' }] }} />);
    fireEvent.click(screen.getByRole('radio', { name: '5' }));
    expect(screen.getByTestId('value')).toHaveTextContent('5');
  });

  it('compare symbols have spoken names', () => {
    render(<Harness q={{ ...base, type: 'compare' }} />);
    fireEvent.click(screen.getByRole('radio', { name: 'is less than' }));
    expect(screen.getByTestId('value')).toHaveTextContent('<');
  });
});

describe('firstUnresolved', () => {
  const qs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const p = (id: string, resolved: boolean) => ({ questionId: id, tries: 1, resolved, correct: resolved, pointsAwarded: 0 });
  it('resumes at the first unfinished question', () => {
    expect(firstUnresolved(qs, {})).toBe(0);
    expect(firstUnresolved(qs, { a: p('a', true), b: p('b', false) })).toBe(1);
    expect(firstUnresolved(qs, { a: p('a', true), b: p('b', true), c: p('c', true) })).toBe(3);
  });
});
