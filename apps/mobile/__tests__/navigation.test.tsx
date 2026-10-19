import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { rpcHandlers, setSession, tableData } from '../test-utils/supabase-mock';

jest.mock('../src/lib/supabase', () => require('../test-utils/supabase-mock'));

const overview = {
  child: { id: 'kid-1', displayName: 'Robin', avatarKey: 'owl', ageGroup: '5-7', learningLevelId: 'lvl', levelName: 'Level 1' },
  stats: { lessonsCompleted: 0, totalStars: 0, totalXp: 0, perfectLessons: 0, dailyChallenges: 0, worldsCompleted: 0 },
  worlds: [
    {
      id: 'w1', title: 'Number Forest', description: '', themeKey: 'forest', displayOrder: 1, unlocked: true, lessonCount: 2, completedCount: 0, lessonsToUnlockNext: 1,
      lessons: [{ id: 'l1', title: 'Count to 10', description: '', difficulty: 1, estimatedMinutes: 5, displayOrder: 1, topicTitle: 'Counting', status: 'not_started', bestStars: 0, bestScore: 0 }],
    },
    { id: 'w2', title: 'Addition Village', description: '', themeKey: 'village', displayOrder: 2, unlocked: false, lessonCount: 2, completedCount: 0, lessonsToUnlockNext: 1, lessons: [] },
  ],
  daily: null,
  badges: [],
  recentAchievements: [],
};

describe('navigation and profiles', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('math-adventure.active-child');
    tableData.child_profiles = [
      { id: 'kid-1', display_name: 'Robin', avatar_key: 'owl' },
      { id: 'kid-2', display_name: 'Sam', avatar_key: 'fox' },
    ];
    rpcHandlers.get_learner_overview = (args) => ({ data: { ...overview, child: { ...overview.child, id: args.p_child_id, displayName: args.p_child_id === 'kid-2' ? 'Sam' : 'Robin' } }, error: null });
  });

  it('sends signed-out users to sign in', async () => {
    setSession(null);
    await renderRouter('./app', { initialUrl: '/' });
    expect(await screen.findByText('Welcome back')).toBeTruthy();
  });

  it('switches between children and opens learner mode', async () => {
    setSession({ user: { id: 'parent', email: 'p@example.test' } });
    await renderRouter('./app', { initialUrl: '/' });
    expect(await screen.findByText('Who’s learning?')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Learn as Sam' })));
    expect(await screen.findByText('Sam')).toBeTruthy();
    expect(screen.getByText('Your adventure starts here')).toBeTruthy();
    await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalledWith('math-adventure.active-child', 'kid-2'));

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Switch' })));
    await act(async () => fireEvent.press(await screen.findByRole('button', { name: 'Learn as Robin' })));
    expect(await screen.findByText('Robin')).toBeTruthy();
  });

  it('the parent area needs the password again', async () => {
    setSession({ user: { id: 'parent', email: 'p@example.test' } });
    await renderRouter('./app', { initialUrl: '/parent' });
    expect(await screen.findByText('Grown-ups only')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Parent password'), 'wrong');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Open parent area' })));
    expect(await screen.findByText('That password isn’t right.')).toBeTruthy();
  });

  it('shows the map with locked worlds explained', async () => {
    setSession({ user: { id: 'parent', email: 'p@example.test' } });
    await SecureStore.setItemAsync('math-adventure.active-child', 'kid-1');
    await renderRouter('./app', { initialUrl: '/learn/map' });
    expect(await screen.findByText('Adventure map')).toBeTruthy();
    expect(screen.getByText('Locked. Finish 1 more lesson in Number Forest to open.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Count to 10, new' })).toBeTruthy();
  });

  it('shows a loading state, then an error state with retry', async () => {
    setSession({ user: { id: 'parent', email: 'p@example.test' } });
    await SecureStore.setItemAsync('math-adventure.active-child', 'kid-1');
    let calls = 0;
    rpcHandlers.get_learner_overview = () => (++calls === 1 ? { data: null, error: { message: 'fetch failed' } } : { data: overview, error: null });
    await renderRouter('./app', { initialUrl: '/learn' });
    expect(await screen.findByText('We could not reach the server. Check your connection and try again.')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Try again' })));
    expect(await screen.findByText('Your adventure starts here')).toBeTruthy();
  });
});
