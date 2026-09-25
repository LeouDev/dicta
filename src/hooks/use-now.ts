import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

// One clock for every relative timestamp on screen: it ticks each minute while
// something shows a time and the app is in the foreground (and at once when it
// returns), so "5m" becomes "6m" without redrawing lists or refetching anything.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
// Before its first event the state can be "unknown"; only a backgrounded app stops the clock.
let foreground = AppState.currentState !== 'background';

const tick = () => {
  now = Date.now();
  listeners.forEach((listener) => listener());
};
const update = () => {
  const running = foreground && listeners.size > 0;
  if (running && !timer) {
    now = Date.now();
    timer = setInterval(tick, 60_000);
  } else if (!running && timer) {
    clearInterval(timer);
    timer = undefined;
  }
};

AppState.addEventListener('change', (state) => {
  foreground = state !== 'background';
  if (state === 'active') tick();
  update();
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  update();
  return () => {
    listeners.delete(listener);
    update();
  };
};

/** The current time, updated every minute. Only components that call it re-render. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now);
}
