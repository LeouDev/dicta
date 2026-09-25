import { createDesign, suggestedFontSize } from '@/features/quote-card/templates';

import { validatePost } from '../validate';

// The draft store persists through expo-sqlite's localStorage; give Jest an in-memory one.
jest.mock('expo-sqlite/localStorage/install', () => {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  return {};
});

// eslint-disable-next-line import/first
import { useComposer } from '../store';

describe('validatePost', () => {
  it('requires text within the limit', () => {
    const design = createDesign('editorial');
    expect(validatePost('   ', design)).toMatch(/write something/i);
    expect(validatePost('x'.repeat(501), design)).toMatch(/under 500/);
    expect(validatePost('A thought.', design)).toBeNull();
  });

  it('requires a photo for photo backgrounds', () => {
    expect(validatePost('Hi', createDesign('photograph'))).toMatch(/photo/i);
    const withPhoto = { ...createDesign('photograph'), background: { type: 'image' as const, uri: 'file:///a.jpg', dim: 0.4 } };
    expect(validatePost('Hi', withPhoto)).toBeNull();
  });
});

describe('composer store', () => {
  beforeEach(() => useComposer.getState().reset());

  it('auto-sizes type to the text until the person picks a size', () => {
    const s = useComposer.getState();
    s.setText('Short.');
    s.autoSize();
    expect(useComposer.getState().design.fontSize).toBe(suggestedFontSize('editorial', 6));

    useComposer.getState().setFontSize(50);
    useComposer.getState().setText('A much longer thought that would normally get a smaller size by default.');
    useComposer.getState().autoSize();
    expect(useComposer.getState().design.fontSize).toBe(50);
  });

  it('switching template restyles and re-enables auto-sizing', () => {
    useComposer.getState().setFontSize(50);
    useComposer.getState().chooseTemplate('midnight');
    const { design, sizeLocked } = useComposer.getState();
    expect(design.template).toBe('midnight');
    expect(design.fontFamily).toBe('elegant');
    expect(sizeLocked).toBe(false);
  });

  it('keeps text readable when the background changes', () => {
    useComposer.getState().update({ textColor: '#1A1714', metaColor: '#1A1714' });
    useComposer.getState().setBackground({ type: 'solid', color: '#0E0E10' });
    expect(useComposer.getState().design.textColor).toBe('#FFFFFF');

    useComposer.getState().update({ textColor: '#9B1B1E' });
    useComposer.getState().setBackground({ type: 'solid', color: '#F6F2EA' });
    expect(useComposer.getState().design.textColor).toBe('#9B1B1E');
  });

  it('caps text at the post limit', () => {
    useComposer.getState().setText('x'.repeat(600));
    expect(useComposer.getState().text).toHaveLength(500);
  });

  it('restores a saved draft, repairing an invalid design', async () => {
    localStorage.setItem(
      'dicta.composer.draft',
      JSON.stringify({ state: { text: 'Saved thought', design: { template: 'journal', fontSize: 'huge' }, sizeLocked: true }, version: 1 }),
    );
    await useComposer.persist.rehydrate();
    const { text, design, sizeLocked } = useComposer.getState();
    expect(text).toBe('Saved thought');
    expect(design).toEqual(createDesign('journal'));
    expect(sizeLocked).toBe(true);
  });
});
