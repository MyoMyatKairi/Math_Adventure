import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NumberChart } from './number-chart';

afterEach(() => vi.useRealTimers());

describe('NumberChart', () => {
  it('shows the chosen number with its word and dots', () => {
    render(<NumberChart />);
    fireEvent.click(screen.getByRole('button', { name: '7, seven' }));
    expect(screen.getByText('seven')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '7 dots' })).toBeInTheDocument();
    expect(screen.getByText('Explored 2 of 10')).toBeInTheDocument();
  });

  it('switches to 1–100 and shows tens and ones', () => {
    render(<NumberChart />);
    fireEvent.click(screen.getByRole('radio', { name: '1–100' }));
    fireEvent.click(screen.getByRole('button', { name: '34, thirty-four' }));
    expect(screen.getByText('3 tens and 4 ones')).toBeInTheDocument();
  });

  it('moves with arrow keys', () => {
    render(<NumberChart />);
    fireEvent.keyDown(screen.getByRole('button', { name: '1, one' }), { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: '2, two' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(screen.getByRole('button', { name: '2, two' }), { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: '7, seven' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('counts through the chart and stops at the end', () => {
    vi.useFakeTimers();
    render(<NumberChart />);
    fireEvent.click(screen.getByRole('button', { name: 'Count with me' }));
    const step = () => act(() => vi.advanceTimersByTime(1300));
    for (let i = 0; i < 3; i++) step();
    expect(screen.getByRole('button', { name: '4, four' })).toHaveAttribute('aria-pressed', 'true');
    for (let i = 0; i < 10; i++) step();
    expect(screen.getByRole('button', { name: '10, ten' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Count with me' })).toBeInTheDocument();
  });
});
