import 'expo-sqlite/localStorage/install';

import { AppState } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { contrastWith, readableTextFor } from '@/features/quote-card/palettes';
import { parseQuoteDesign } from '@/features/quote-card/serialize';
import { applyTemplate, createDesign } from '@/features/quote-card/templates';
import { TEXT_MAX_LENGTH, type CardBackground, type QuoteDesign, type TemplateId } from '@/features/quote-card/types';
import type { CardContent, FeedPost } from '@/types/models';

/** A post holds up to 10 cards (services/posts MAX_CARDS; kept here so the store doesn't load the services). */
export const MAX_STACK = 10;

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
  /** The card being edited (the post itself, or one card of a stack). */
  text: string;
  design: QuoteDesign;
  /** Optional Discover topic (topics.slug). */
  topic: string | null;
  /** Every card of a stack, in order, with `current` the one in text/design (whose copy here may be stale). Empty for one card. */
  cards: CardContent[];
  current: number;
}

/** All the draft's cards in order, with the one being edited up to date. */
export function stackOf(draft: Pick<Draft, 'text' | 'design' | 'cards' | 'current'>): CardContent[] {
  const live = { text: draft.text, design: draft.design };
  return draft.cards.length ? draft.cards.map((card, i) => (i === draft.current ? live : card)) : [live];
}

/** The draft showing card `index` of `cards` (one card collapses back to a plain draft). */
const showCard = (cards: CardContent[], index: number) =>
  cards.length > 1 ? { cards, current: index, text: cards[index].text, design: cards[index].design } : { cards: [], current: 0, text: cards[0].text, design: cards[0].design };

interface ComposerState extends Draft {
  /** The published post being edited, if any. Meanwhile the draft waits in `saved`, and that's what stays on disk. */
  editing: { postId: string; photoPaths: string[] } | null;
  /** Writing a story; the draft waits in `saved` the same way. */
  story: boolean;
  saved: Draft | null;
  /** Opens a published post in the composer, setting the draft aside. */
  startEdit: (post: Pick<FeedPost, 'id' | 'text' | 'design' | 'topic' | 'cards'>) => void;
  /** Leaves the post, saved or not, and brings the draft back. */
  endEdit: () => void;
  /** Starts a fresh story card (9:16), setting the draft aside. */
  startStory: () => void;
  endStory: () => void;
  /** Adds an empty card after the current one, styled like it, and shows it. */
  addCard: () => void;
  selectCard: (index: number) => void;
  removeCard: (index: number) => void;
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

const fresh = () => ({
  text: '',
  design: createDesign('editorial'),
  topic: null,
  cards: [] as CardContent[],
  current: 0,
  editing: null,
  story: false,
  saved: null,
});

const draftOf = ({ text, design, topic, cards, current }: Draft): Draft => ({ text, design, topic, cards, current });

/** Photos that may be gone since: choosing Photo again picks a new one. */
const withoutStalePhoto = (design: QuoteDesign): QuoteDesign =>
  design.background.type === 'image' ? design : { ...design, background: { ...design.background, image: null, path: undefined } };

const uploadedPhoto = (design: QuoteDesign) => (design.background.type === 'image' ? (design.background.path ?? null) : null);

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
          const cards = [{ text: post.text, design: post.design }, ...post.cards];
          return {
            editing: { postId: post.id, photoPaths: cards.map((card) => uploadedPhoto(card.design)).filter((p): p is string => p !== null) },
            saved: draftOf(s),
            topic: post.topic,
            ...showCard(cards.map((card) => ({ ...card, design: withoutStalePhoto(card.design) })), 0),
          };
        }),
      endEdit: () => set((s) => ({ ...(s.saved ?? fresh()), editing: null, saved: null })),
      startStory: () =>
        set((s) => ({
          story: true,
          saved: draftOf(s),
          text: '',
          design: { ...createDesign('editorial'), canvas: '9:16' },
          topic: null,
          cards: [],
          current: 0,
        })),
      endStory: () => set((s) => ({ ...(s.saved ?? fresh()), story: false, saved: null })),
      addCard: () =>
        set((s) => {
          const all = stackOf(s);
          if (all.length >= MAX_STACK) return s;
          const at = s.current + 1;
          return showCard([...all.slice(0, at), { text: '', design: s.design }, ...all.slice(at)], at);
        }),
      selectCard: (index) =>
        set((s) => {
          const all = stackOf(s);
          return index === s.current || !all[index] ? s : showCard(all, index);
        }),
      removeCard: (index) =>
        set((s) => {
          const all = stackOf(s);
          if (all.length <= 1 || !all[index]) return s;
          const rest = all.filter((_, i) => i !== index);
          const current = index < s.current ? s.current - 1 : Math.min(s.current, rest.length - 1);
          return showCard(rest, current);
        }),
    }),
    {
      name: 'dicta.composer.draft',
      version: 1,
      storage: createJSONStorage(() => draftStorage),
      partialize: (s): Draft => ((s.editing || s.story) && s.saved ? s.saved : draftOf(s)),
      // Drafts may come from an older app version (including v1 designs): validate on the way in.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Draft>;
        const text = typeof p.text === 'string' ? p.text.slice(0, TEXT_MAX_LENGTH) : '';
        const design = p.design ? parseQuoteDesign(p.design) : current.design;
        const cards = (Array.isArray(p.cards) ? p.cards : [])
          .filter((c): c is CardContent => typeof c === 'object' && c !== null)
          .slice(0, MAX_STACK)
          .map((c) => ({ text: typeof c.text === 'string' ? c.text.slice(0, TEXT_MAX_LENGTH) : '', design: parseQuoteDesign(c.design) }));
        const index = typeof p.current === 'number' && cards[p.current] ? p.current : 0;
        return {
          ...current,
          topic: typeof p.topic === 'string' ? p.topic : null,
          ...(cards.length > 1 ? { ...showCard(cards, index), text, design } : { cards: [], current: 0, text, design }),
        };
      },
    },
  ),
);
