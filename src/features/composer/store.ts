import 'expo-sqlite/localStorage/install';

import { AppState } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { contrastWith, readableTextFor } from '@/features/quote-card/palettes';
import { parseQuoteDesign } from '@/features/quote-card/serialize';
import { applyTemplate, createDesign } from '@/features/quote-card/templates';
import { TEXT_MAX_LENGTH, type CardBackground, type QuoteDesign, type TemplateId } from '@/features/quote-card/types';
import type { FeedPost } from '@/types/models';

/** A partial design where nested groups (background, texture, header, signature) merge too. */
export type DesignPatch = Partial<Omit<QuoteDesign, 'background' | 'texture' | 'header' | 'signature'>> & {
  background?: Partial<CardBackground>;
  texture?: Partial<QuoteDesign['texture']>;
  header?: Partial<QuoteDesign['header']>;
  signature?: Partial<QuoteDesign['signature']>;
};

export function mergeDesign(design: QuoteDesign, patch: DesignPatch): QuoteDesign {
  return {
    ...design,
    ...patch,
    background: { ...design.background, ...patch.background },
    texture: { ...design.texture, ...patch.texture },
    header: { ...design.header, ...patch.header },
    signature: { ...design.signature, ...patch.signature },
  };
}

interface Draft {
  text: string;
  design: QuoteDesign;
  /** Optional Discover topic (topics.slug). */
  topic: string | null;
}

interface ComposerState extends Draft {
  /** The published post being edited, if any. Meanwhile the draft waits in `saved`, and that's what stays on disk. */
  editing: { postId: string; photoPath: string | null } | null;
  saved: Draft | null;
  /** Opens a published post in the composer, setting the draft aside. */
  startEdit: (post: Pick<FeedPost, 'id' | 'text' | 'design' | 'topic'>) => void;
  /** Leaves the post, saved or not, and brings the draft back. */
  endEdit: () => void;
  setText: (text: string) => void;
  setTopic: (topic: string | null) => void;
  update: (patch: DesignPatch) => void;
  /** Changes the background and fixes a text color that would become unreadable on it. */
  setBackground: (patch: Partial<CardBackground>) => void;
  chooseTemplate: (template: TemplateId) => void;
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

const fresh = () => ({ text: '', design: createDesign('editorial'), topic: null, editing: null, saved: null });

export const useComposer = create<ComposerState>()(
  persist(
    (set) => ({
      ...fresh(),
      setText: (text) => set({ text: text.slice(0, TEXT_MAX_LENGTH) }),
      setTopic: (topic) => set({ topic }),
      update: (patch) => set((s) => ({ design: mergeDesign(s.design, patch) })),
      setBackground: (patch) =>
        set((s) => {
          const background = { ...s.design.background, ...patch };
          const textColor = contrastWith(s.design.textColor, background) < 3 ? readableTextFor(background) : s.design.textColor;
          return { design: { ...s.design, background, textColor } };
        }),
      chooseTemplate: (template) => set((s) => ({ design: applyTemplate(s.design, template) })),
      reset: () => set(fresh()),
      startEdit: (post) =>
        set((s) => {
          const bg = post.design.background;
          const photo = bg.type === 'image';
          return {
            editing: { postId: post.id, photoPath: photo ? (bg.path ?? null) : null },
            saved: { text: s.text, design: s.design, topic: s.topic },
            text: post.text,
            // A photo the card no longer shows may be gone, so choosing Photo again picks a new one.
            design: photo ? post.design : { ...post.design, background: { ...bg, image: null, path: undefined } },
            topic: post.topic,
          };
        }),
      endEdit: () => set((s) => ({ ...s.saved, editing: null, saved: null })),
    }),
    {
      name: 'dicta.composer.draft',
      version: 1,
      storage: createJSONStorage(() => draftStorage),
      partialize: ({ text, design, topic, editing, saved }): Draft => (editing && saved ? saved : { text, design, topic }),
      // Drafts may come from an older app version (including v1 designs): validate on the way in.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Draft>;
        return {
          ...current,
          text: typeof p.text === 'string' ? p.text.slice(0, TEXT_MAX_LENGTH) : '',
          design: p.design ? parseQuoteDesign(p.design) : current.design,
          topic: typeof p.topic === 'string' ? p.topic : null,
        };
      },
    },
  ),
);
