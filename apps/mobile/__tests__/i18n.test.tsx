import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LessonPlayer } from '../src/components/lesson-player';
import { LanguageSwitcher } from '../src/components/ui';
import { LocaleProvider } from '../src/lib/i18n';
import { rpcHandlers, supabase, tableData } from '../test-utils/supabase-mock';

jest.mock('../src/lib/supabase', () => require('../test-utils/supabase-mock'));

describe('language', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    tableData.lesson_sections = [
      {
        content_json: { kind: 'introduction', text: 'Adding means putting groups together.' },
        translations: { th: { title: 'มาเรียนกัน', content: { kind: 'introduction', text: 'การบวกคือการรวมกลุ่มเข้าด้วยกัน' } } },
      },
    ];
    tableData.lessons = [{ title: 'Adding', learning_objective: 'I can add.', translations: { th: { title: 'การบวก', learning_objective: 'ฉันบวกได้' } } }];
    rpcHandlers.start_lesson = () => ({ data: null, error: { message: 'world_locked' } });
  });

  it('switching to Thai translates the interface and content, asks the server for Thai, and is remembered', async () => {
    await render(
      <LocaleProvider>
        <LanguageSwitcher />
        <LessonPlayer childId="c" lessonId="l" ageGroup="8-10" isDaily={false} onExit={() => {}} />
      </LocaleProvider>,
    );
    expect(await screen.findByText('Adding means putting groups together.')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'ไทย' })));
    expect(await screen.findByText('การบวกคือการรวมกลุ่มเข้าด้วยกัน')).toBeTruthy();
    expect(screen.getByText('การบวก: ฉันบวกได้')).toBeTruthy();
    expect(await AsyncStorage.getItem('ma_locale')).toBe('th');

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'เริ่มฝึก' })));
    expect(supabase.rpc).toHaveBeenLastCalledWith('start_lesson', expect.objectContaining({ p_locale: 'th' }));
    expect(await screen.findByText('ทำบทเรียนในโลกก่อนหน้าให้จบมากขึ้นเพื่อเปิดโลกนี้')).toBeTruthy();
  });
});
