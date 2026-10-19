import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { rpcHandlers, tableData } from '../test-utils/supabase-mock';
import { LessonPlayer } from '../src/components/lesson-player';

jest.mock('../src/lib/supabase', () => require('../test-utils/supabase-mock'));

const Q1 = '00000000-0000-4000-8000-000000000001';
const Q2 = '00000000-0000-4000-8000-000000000002';

function setup() {
  tableData.lesson_sections = [
    { content_json: { kind: 'introduction', text: 'Adding means putting groups together.' } },
    { content_json: { kind: 'worked_example', problem: '3 + 2', steps: ['Start with 3.', 'Count on 2.'] } },
  ];
  tableData.lessons = [{ title: 'Adding', learning_objective: 'I can add.' }];
  rpcHandlers.start_lesson = () => ({
    data: {
      attemptId: 'att',
      resumed: false,
      isDailyChallenge: false,
      lesson: { id: 'l', title: 'Adding', description: '', learningObjective: '', difficulty: 1, estimatedMinutes: 5, worldTitle: 'W', topicTitle: 'T' },
      sections: [],
      questions: [
        { id: Q1, type: 'numeric', prompt: 'What is 3 + 4?', visual: null, options: null, hint: 'Count on 4.', answerFormat: 'any', difficulty: 1, points: 10 },
        { id: Q2, type: 'compare', prompt: 'Which sign?', visual: { kind: 'compare', left: '2', right: '5' }, options: null, hint: null, answerFormat: 'any', difficulty: 1, points: 10 },
      ],
      progress: [],
    },
    error: null,
  });
  let tries = 0;
  rpcHandlers.submit_answer = (args) => {
    if (args.p_question_id === Q1) {
      tries++;
      return tries === 1
        ? { data: { status: 'answered', isCorrect: false, attemptNumber: 1, triesRemaining: 1, resolved: false, pointsAwarded: 0, hint: 'Count on 4.', explanation: null, correctAnswer: null }, error: null }
        : { data: { status: 'answered', isCorrect: true, attemptNumber: 2, triesRemaining: 0, resolved: true, pointsAwarded: 5, hint: null, explanation: 'Start at 3 and count on 4: 7.', correctAnswer: '7' }, error: null };
    }
    return { data: { status: 'answered', isCorrect: true, attemptNumber: 1, triesRemaining: 0, resolved: true, pointsAwarded: 10, hint: null, explanation: '2 is less than 5.', correctAnswer: '<' }, error: null };
  };
  rpcHandlers.complete_lesson = () => ({
    data: { attemptId: 'att', lessonId: 'l', score: 75, totalQuestions: 2, correctAnswers: 1, stars: 2, bestStars: 2, xpAwarded: 30, starsAwarded: 2, isDailyChallenge: false, dailyBonusXp: 0, newBadges: [{ key: 'first-steps', title: 'First Steps', description: 'Finished your first lesson.', iconKey: 'footprints' }], unlockedWorlds: [], alreadyCompleted: false },
    error: null,
  });
}

describe('LessonPlayer (mobile)', () => {
  beforeEach(setup);

  it('shows the introduction and example, then plays through with feedback', async () => {
    await render(<LessonPlayer childId="c" lessonId="l" ageGroup="8-10" isDaily={false} onExit={() => {}} />);
    expect(await screen.findByText('Adding means putting groups together.')).toBeTruthy();
    expect(screen.getByText('1. Start with 3.')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Start practice' })));
    expect(await screen.findByText('What is 3 + 4?')).toBeTruthy();

    // Invalid input is caught on the device and doesn't use a try.
    await fireEvent.changeText(screen.getByLabelText('Your answer'), 'abc');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Check answer' })));
    expect(screen.getByText('Type a number, like 7, -3, 2.5 or 3/4.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Your answer'), '6');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Check answer' })));
    expect(await screen.findByTestId('feedback-retry')).toBeTruthy();
    expect(screen.getByText('Hint: Count on 4.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Your answer'), '7');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Check answer' })));
    expect(await screen.findByTestId('feedback-correct')).toBeTruthy();
    expect(screen.getByText('Start at 3 and count on 4: 7.')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Next question' })));
    await fireEvent.press(await screen.findByRole('radio', { name: 'is less than' }));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Check answer' })));
    await act(async () => fireEvent.press(await screen.findByRole('button', { name: 'Finish lesson' })));

    expect(await screen.findByText('Great job!')).toBeTruthy();
    expect(screen.getByText('+30')).toBeTruthy();
    expect(screen.getByText('New badge: First Steps. Finished your first lesson.')).toBeTruthy();
  });

  it('shows a friendly error when the lesson cannot start', async () => {
    rpcHandlers.start_lesson = () => ({ data: null, error: { message: 'world_locked' } });
    await render(<LessonPlayer childId="c" lessonId="l" ageGroup="8-10" isDaily={false} onExit={() => {}} />);
    await screen.findByText('Adding means putting groups together.');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Start practice' })));
    await waitFor(() => expect(screen.getByText('Finish more lessons in the world before this one to open it.')).toBeTruthy());
  });
});
