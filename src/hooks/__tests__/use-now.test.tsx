import { act, renderHook } from '@testing-library/react-native';

import { useNow } from '../use-now';

jest.useFakeTimers();

it('ticks every minute while something shows the time, and stops after', async () => {
  const started = jest.spyOn(global, 'setInterval');
  const stopped = jest.spyOn(global, 'clearInterval');
  const { result, unmount } = await renderHook(() => useNow());
  const first = result.current;
  const clock = started.mock.results[started.mock.calls.findIndex(([, ms]) => ms === 60_000)]?.value;
  expect(clock).toBeDefined();

  await act(async () => {
    jest.advanceTimersByTime(60_000);
  });
  expect(result.current).toBeGreaterThanOrEqual(first + 60_000);

  await unmount();
  expect(stopped).toHaveBeenCalledWith(clock);
});
