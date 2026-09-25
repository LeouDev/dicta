import { createDesign } from '@/features/quote-card/templates';

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
import { mergeDesign, useComposer } from '../store';

describe('validatePost', () => {
  it('requires text within the limit', () => {
    const design = createDesign('editorial');
    expect(validatePost('   ', design)).toMatch(/write something/i);
    expect(validatePost('x'.repeat(501), design)).toMatch(/under 500/);
    expect(validatePost('A thought.', design)).toBeNull();
  });

  it('requires a photo for photo backgrounds', () => {
    const photo = createDesign('photograph');
    expect(validatePost('Hi', photo)).toMatch(/photo/i);
    expect(validatePost('Hi', { ...photo, background: { ...photo.background, image: 'file:///a.jpg' } })).toBeNull();
  });
});

describe('composer store', () => {
  beforeEach(() => useComposer.getState().reset());

  it('merges nested design patches', () => {
    const base = createDesign('editorial');
    const next = mergeDesign(base, { size: 60, header: { avatar: false }, texture: { strength: 0.2 } });
    expect(next).toEqual({ ...base, size: 60, header: { ...base.header, avatar: false }, texture: { ...base.texture, strength: 0.2 } });
  });

  it('switching template restyles but keeps the canvas', () => {
    useComposer.getState().update({ canvas: '9:16', size: 50 });
    useComposer.getState().chooseTemplate('midnight');
    const { design } = useComposer.getState();
    expect(design).toMatchObject({ template: 'midnight', font: 'elegant', canvas: '9:16', size: createDesign('midnight').size });
  });

  it('keeps text readable when the background changes', () => {
    useComposer.getState().update({ textColor: '#1A1714' });
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
      JSON.stringify({ state: { text: 'Saved thought', design: { version: 2, template: 'journal', size: 'huge' }, topic: 'healing' }, version: 1 }),
    );
    await useComposer.persist.rehydrate();
    const { text, design, topic } = useComposer.getState();
    expect(text).toBe('Saved thought');
    expect(design).toEqual(createDesign('journal'));
    expect(topic).toBe('healing');
  });

  it('upgrades a draft saved by the previous app version', async () => {
    localStorage.setItem(
      'dicta.composer.draft',
      JSON.stringify({ state: { text: 'Old draft', design: { version: 1, template: 'midnight', fontFamily: 'typewriter', format: 'square' } }, version: 1 }),
    );
    await useComposer.persist.rehydrate();
    expect(useComposer.getState().design).toMatchObject({ version: 2, template: 'midnight', font: 'typewriter', canvas: '1:1' });
  });
});
