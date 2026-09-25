import 'expo-sqlite/localStorage/install';

import { AppState } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { contrastWith, readableTextFor } from '@/features/quote-card/palettes';
import { parseQuoteDesign } from '@/features/quote-card/serialize';
import { applyTemplate, createDesign, suggestedFontSize } from '@/features/quote-card/templates';
import { TEXT_MAX_LENGTH, type CardBackground, type QuoteDesign, type TemplateId } from '@/features/quote-card/types';

interface ComposerState {
  text: string;
  design: QuoteDesign;
  /** Set once the person drags the size slider; stops auto-sizing to text length. */
  sizeLocked: boolean;
  /** Optional Discover topic (topics.slug). */
  topic: string | null;
  setText: (text: string) => void;
  setTopic: (topic: string | null) => void;
  update: (patch: Partial<QuoteDesign>) => void;
  /** Changes the background and fixes text colors that would become unreadable on it. */
  setBackground: (background: CardBackground) => void;
  setFontSize: (fontSize: number) => void;
  chooseTemplate: (template: TemplateId) => void;
  /** Re-suggest a font size for the current text, unless the person picked one. */
  autoSize: () => void;
  reset: () => void;
}

// Drafts are written at most every 400ms (slider drags fire 60×/s) and flushed
// when the app backgrounds, so a crash or swipe-away never loses a quote.
let pendingWrite: { key: string; value: string } | null = null;
let writeTimer: ReturnType<typeof setTimeout> | undefined;
const flush = () => {
  clearTimeout(writeTimer);
  if (pendingWrite) localStorage.setItem(pendingWrite.key, pendingWrite.value);
  pendingWrite = null;
};
AppState.addEventListener('change', (state) => state !== 'active' && flush());

const draftStorage: StateStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => {
    pendingWrite = { key, value };
    clearTimeout(writeTimer);
    writeTimer = setTimeout(flush, 400);
  },
  removeItem: (key) => {
    pendingWrite = null;
    localStorage.removeItem(key);
  },
};

const fresh = () => ({ text: '', design: createDesign('editorial'), sizeLocked: false, topic: null });

export const useComposer = create<ComposerState>()(
  persist(
    (set) => ({
      ...fresh(),
      setText: (text) => set({ text: text.slice(0, TEXT_MAX_LENGTH) }),
      setTopic: (topic) => set({ topic }),
      update: (patch) => set((s) => ({ design: { ...s.design, ...patch } })),
      setBackground: (background) =>
        set((s) => {
          const readable = readableTextFor(background);
          return {
            design: {
              ...s.design,
              background,
              textColor: contrastWith(s.design.textColor, background) < 3 ? readable : s.design.textColor,
              metaColor: contrastWith(s.design.metaColor, background) < 3 ? readable : s.design.metaColor,
            },
          };
        }),
      setFontSize: (fontSize) => set((s) => ({ design: { ...s.design, fontSize }, sizeLocked: true })),
      chooseTemplate: (template) =>
        set((s) => ({
          design: { ...applyTemplate(s.design, template), fontSize: suggestedFontSize(template, s.text.trim().length) },
          sizeLocked: false,
        })),
      autoSize: () =>
        set((s) =>
          s.sizeLocked ? s : { design: { ...s.design, fontSize: suggestedFontSize(s.design.template, s.text.trim().length) } },
        ),
      reset: () => set(fresh()),
    }),
    {
      name: 'dicta.composer.draft',
      version: 1,
      storage: createJSONStorage(() => draftStorage),
      partialize: ({ text, design, sizeLocked, topic }) => ({ text, design, sizeLocked, topic }),
      // Drafts may come from an older app version: validate on the way in.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<ComposerState, 'text' | 'design' | 'sizeLocked' | 'topic'>>;
        return {
          ...current,
          text: typeof p.text === 'string' ? p.text.slice(0, TEXT_MAX_LENGTH) : '',
          design: p.design ? parseQuoteDesign(p.design) : current.design,
          sizeLocked: p.sizeLocked === true,
          topic: typeof p.topic === 'string' ? p.topic : null,
        };
      },
    },
  ),
);
