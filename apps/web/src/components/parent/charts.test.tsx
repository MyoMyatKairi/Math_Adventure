import { summarizeTopics } from '@math-adventure/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopicBars, WeeklyChart } from './charts';

describe('parent charts', () => {
  it('weekly chart has an accessible table and an honest empty message', () => {
    const days = Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-${String(13 + i).padStart(2, '0')}`, lessonsCompleted: 0, questionsAnswered: 0 }));
    render(<WeeklyChart days={days} />);
    expect(screen.getByText('No lessons finished in the last 7 days.')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(8);
  });

  it('topic bars label status in words, not colour alone', () => {
    const topics = summarizeTopics([
      { topicId: 'a', topicTitle: 'Fractions', questionsAnswered: 10, firstTryCorrect: 3, lessonsCompleted: 1, lessonCount: 3 },
      { topicId: 'b', topicTitle: 'Division', questionsAnswered: 0, firstTryCorrect: 0, lessonsCompleted: 0, lessonCount: 3 },
    ]);
    render(<TopicBars topics={topics} />);
    expect(screen.getByText('Practise again')).toBeInTheDocument();
    expect(screen.getByText('Not started')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fractions: 30% correct first time' })).toBeInTheDocument();
  });
});
