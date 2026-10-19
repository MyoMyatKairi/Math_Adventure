import type { PublicQuestion } from '@math-adventure/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { ANSWER_INPUTS } from '../src/components/answer-inputs';

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

function Harness({ q, ageGroup = '8-10' as const }: { q: PublicQuestion; ageGroup?: '5-7' | '8-10' | '11-12' }) {
  const [v, setV] = useState('');
  const Input = ANSWER_INPUTS[q.type];
  return <Input question={q} value={v} onChange={setV} onSubmit={() => {}} disabled={false} ageGroup={ageGroup} />;
}

describe('touch-friendly answer controls', () => {
  it('builds a number with the keypad, including minus and delete', async () => {
    await render(<Harness q={{ ...base, type: 'numeric' }} />);
    await fireEvent.press(screen.getByLabelText('minus'));
    await fireEvent.press(screen.getByLabelText('1'));
    await fireEvent.press(screen.getByLabelText('2'));
    await fireEvent.press(screen.getByLabelText('Delete last character'));
    await fireEvent.press(screen.getByLabelText('5'));
    expect(screen.getByLabelText('Your answer').props.value).toBe('-15');
  });

  it('gives young learners a simpler keypad without minus or decimal keys', async () => {
    await render(<Harness q={{ ...base, type: 'numeric' }} ageGroup="5-7" />);
    expect(screen.queryByLabelText('minus')).toBeNull();
    expect(screen.queryByLabelText('decimal point')).toBeNull();
  });

  it('offers a fraction key when the answer must be a fraction', async () => {
    await render(<Harness q={{ ...base, type: 'numeric', answerFormat: 'fraction' }} />);
    expect(screen.getByLabelText('fraction bar')).toBeTruthy();
  });

  it('selects one multiple-choice option at a time', async () => {
    await render(<Harness q={{ ...base, type: 'multiple_choice', options: [{ id: 'a', label: 'circle' }, { id: 'b', label: 'square' }] }} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'square' }));
    expect(screen.getByRole('radio', { name: 'square' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'circle' })).not.toBeChecked();
  });

  it('compare uses large named symbol buttons', async () => {
    await render(<Harness q={{ ...base, type: 'compare' }} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'is greater than' }));
    expect(screen.getByRole('radio', { name: 'is greater than' })).toBeChecked();
  });
});
