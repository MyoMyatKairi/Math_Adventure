import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Screen, styles } from '../src/components/ui';
import { Visual } from '../src/components/visual';
import { TOUCH } from '../src/theme';

describe('responsive layout', () => {
  it('content is fluid up to a readable max width on tablets', async () => {
    expect(styles.column).toMatchObject({ width: '100%', maxWidth: 720, alignSelf: 'center' });
  });
  it('inputs and buttons meet the touch-target size', async () => {
    expect(TOUCH).toBeGreaterThanOrEqual(48);
    expect(styles.input.minHeight).toBeGreaterThanOrEqual(48);
  });
  it('visuals scale to the screen width and are described for screen readers', async () => {
    await render(
      <Screen>
        <Text>x</Text>
        <Visual visual={{ kind: 'objects', object: 'apple', groups: [3, 2] }} />
      </Screen>,
    );
    expect(screen.getByLabelText('5 apples in groups of 3 and 2.')).toBeTruthy();
  });
});
