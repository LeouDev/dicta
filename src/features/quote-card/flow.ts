/**
 * Pure text flow for quote cards: paragraphs → compositions → lines → words.
 * No Skia here; the caller passes `measure`, so this runs (and is tested) anywhere.
 */
import type { Box } from './geometry';
import type { QuoteDesign, TextAlign, TextTransform } from './types';

export type Role = 'body' | 'kicker' | 'highlight';

/** What the flow places as one unit: a word, or a single Chinese or Japanese character. */
export interface Token {
  text: string;
  /** Written straight after the previous token, with no space between (Chinese, Japanese). */
  glued: boolean;
}

/** A paragraph of source text: forced lines (single newlines) of tokens. */
export interface SourceParagraph {
  lines: Token[][];
  /** Right-to-left (Arabic, Hebrew): words run from the right. */
  rtl: boolean;
  /** BCP 47 language for scripts whose glyphs vary by language (Chinese, Japanese, Korean, Arabic). */
  lang?: string;
}

interface FlowParagraph extends SourceParagraph {
  role: Role;
}

type Column = FlowParagraph[];

// Scripts written without spaces between words: every character can start a line.
const CJK = /[⺀-⿟々-〇〡-〩〱-〵〸-〼぀-ヿㇰ-ㇿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]|[\u{20000}-\u{3134F}]/u;
// Line-break rules (kinsoku): these never start a line, so they stay with what's before…
const NO_START = new Set([...'、。，．：；？！）］｝〕〉》」』】〙〗〟’”｠»ー…‥・ヽヾゝゞ々〻ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ％,.;:!?)]}%']);
// …and these never end one, so they stay with what's after.
const NO_END = new Set([...'（［｛〔〈《「『【〘〖〝‘“｟«([{']);

const RTL_LETTER = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_LETTER = /[A-Za-zÀ-ɏͰ-ϿЀ-ԯḀ-῿぀-ヿ㐀-鿿가-힯]/;

/** true = right-to-left, false = left-to-right, null = neutral (digits, punctuation, emoji). */
function direction(text: string): boolean | null {
  for (const ch of text) {
    if (RTL_LETTER.test(ch)) return true;
    if (LTR_LETTER.test(ch)) return false;
  }
  return null;
}

function language(text: string): string | undefined {
  if (/[぀-ヿㇰ-ㇿｦ-ﾟ]/.test(text)) return 'ja';
  if (/[ᄀ-ᇿ㄰-㆏가-힯]/.test(text)) return 'ko';
  if (/[㐀-䶿一-鿿豈-﫿]|[\u{20000}-\u{3134F}]/u.test(text)) return 'zh';
  if (/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(text)) return 'ar';
  if (/[֐-׿יִ-ﭏ]/.test(text)) return 'he';
  return undefined;
}

/** A space-separated chunk as tokens: Chinese and Japanese break between characters. */
function tokenize(chunk: string): Token[] {
  const units: string[] = [];
  let unit = '';
  let unitIsCjk = false;
  for (const ch of chunk) {
    const cjk = CJK.test(ch);
    const last = [...unit].pop() ?? '';
    if (unit && (NO_START.has(ch) || NO_END.has(last) || !(cjk || unitIsCjk))) {
      unit += ch;
    } else {
      if (unit) units.push(unit);
      unit = ch;
      unitIsCjk = cjk;
    }
  }
  if (unit) units.push(unit);
  return units.map((text, i) => ({ text, glued: i > 0 }));
}

/** Blank lines separate paragraphs; a single newline is a forced line break. */
export function splitParagraphs(text: string): SourceParagraph[] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .map((line) => line.trim().split(/\s+/).filter(Boolean).flatMap(tokenize))
        .filter((line) => line.length > 0),
    )
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const all = lines.flat().map((t) => t.text).join(' ');
      return { lines, rtl: direction(all) === true, lang: language(all) };
    });
}

const cased = (lines: Token[][], transform: TextTransform) =>
  transform === 'uppercase' ? lines.map((line) => line.map((t) => ({ ...t, text: t.text.toUpperCase() }))) : lines;

const endsWithColon = (t: Token) => t.text.endsWith(':') || t.text.endsWith('：');

/** Kicker text: paragraph 1, or its first line, or the words through the first one ending in ":". */
function splitKicker(paragraphs: SourceParagraph[]): { kicker: SourceParagraph | null; rest: SourceParagraph[] } {
  if (paragraphs.length > 1) return { kicker: paragraphs[0], rest: paragraphs.slice(1) };
  const only = paragraphs[0];
  if (!only) return { kicker: null, rest: [] };
  if (only.lines.length > 1) return { kicker: { ...only, lines: [only.lines[0]] }, rest: [{ ...only, lines: only.lines.slice(1) }] };
  const words = only.lines[0];
  const colon = words.findIndex(endsWithColon);
  if (colon >= 0 && colon < words.length - 1) {
    return { kicker: { ...only, lines: [words.slice(0, colon + 1)] }, rest: [{ ...only, lines: [words.slice(colon + 1)] }] };
  }
  return { kicker: null, rest: paragraphs };
}

/** Arranges paragraphs into one or two columns for the design's composition. */
export function compose(
  design: Pick<QuoteDesign, 'composition' | 'textTransform' | 'secondTransform'>,
  paragraphs: SourceParagraph[],
): Column[] {
  const t = design.textTransform;
  const as = (role: Role, p: SourceParagraph, transform = t): FlowParagraph => ({ ...p, role, lines: cased(p.lines, transform) });

  if (design.composition === 'kicker') {
    const { kicker, rest } = splitKicker(paragraphs);
    return [[...(kicker ? [as('kicker', kicker)] : []), ...rest.map((p) => as('body', p))]];
  }
  if (design.composition === 'columns') {
    const second = design.secondTransform ?? t;
    if (paragraphs.length === 1) {
      const only = paragraphs[0];
      const words = only.lines.flat();
      const half = Math.ceil(words.length / 2);
      return [[as('body', { ...only, lines: [words.slice(0, half)] })], words.length > 1 ? [as('body', { ...only, lines: [words.slice(half)] }, second)] : []];
    }
    return [paragraphs[0] ? [as('body', paragraphs[0])] : [], paragraphs.slice(1).map((p) => as('body', p, second))];
  }
  if (design.composition === 'highlight') {
    return [paragraphs.map((p, i) => as(i === 0 ? 'highlight' : 'body', p))];
  }
  return [paragraphs.map((p) => as('body', p))];
}

export interface FlowWord {
  text: string;
  /** Left edge of the glyphs and top of the line box, relative to the block. */
  x: number;
  y: number;
  width: number;
  size: number;
  /** Line box height in px. */
  lineHeight: number;
  role: Role;
  /** Reading-order index, for the editorial wave. */
  index: number;
  /** The paragraph runs right to left. */
  rtl: boolean;
  lang?: string;
}

export interface FlowResult {
  words: FlowWord[];
  /** Highlighter marks behind highlight words. */
  marks: Box[];
  /** One box per paragraph (the element box a text gradient spans). */
  boxes: (Box & { role: Role })[];
  /** Line boxes of body text, in order (for ruled paper). */
  lines: { y: number; height: number }[];
  height: number;
  /** False when a single word is wider than its column at this size. */
  fits: boolean;
}

export interface FlowOptions {
  /** Body font size in px. */
  size: number;
  /** Block width in px. */
  width: number;
  /** Gap between columns (and between paragraphs within a column) in px. */
  colGap: number;
  /** Least horizontal gap between two columns in px (keeps text off a split background's strip). */
  minColumnGap?: number;
  lineHeight: number;
  kickerScale: number;
  align: TextAlign;
  /** Space between words, in em. */
  wordGap: number;
  /** Advance width of a word at a 100px font size, in a paragraph of this language. */
  measure: (word: string, lang?: string) => number;
}

const HIGHLIGHT_PAD = 0.14;

/**
 * Left-to-right order of a line's words (indices into it). Words keep their own
 * direction: a run of right-to-left words is reversed, and in a right-to-left
 * paragraph the runs are too. Neutral words (digits, punctuation) join the
 * direction around them.
 */
export function visualOrder(dirs: (boolean | null)[], rtl: boolean): number[] {
  if (!rtl && !dirs.includes(true)) return dirs.map((_, i) => i);
  const strongAt = (i: number, step: number) => {
    for (let j = i + step; j >= 0 && j < dirs.length; j += step) if (dirs[j] !== null) return dirs[j];
    return null;
  };
  const resolved = dirs.map((d, i) => {
    if (d !== null) return d;
    const before = strongAt(i, -1);
    return before !== null && before === strongAt(i, 1) ? before : rtl;
  });
  const runs: { rtl: boolean; items: number[] }[] = [];
  resolved.forEach((d, i) => {
    const run = runs.at(-1);
    if (run && run.rtl === d) run.items.push(i);
    else runs.push({ rtl: d, items: [i] });
  });
  return (rtl ? runs.reverse() : runs).flatMap((run) => (run.rtl ? run.items.reverse() : run.items));
}

/** Lays out columns of paragraphs at one font size. */
export function flowColumns(columns: Column[], o: FlowOptions): FlowResult {
  const count = columns.filter((c) => c.length > 0).length > 1 ? 2 : 1;
  const gutter = Math.max(o.colGap, o.minColumnGap ?? 0);
  const colWidth = count === 2 ? (o.width - gutter) / 2 : o.width;
  const result: FlowResult = { words: [], marks: [], boxes: [], lines: [], height: 0, fits: true };
  let index = 0;

  columns.slice(0, count).forEach((column, c) => {
    const x0 = c * (colWidth + gutter);
    let y = 0;
    column.forEach((paragraph, k) => {
      if (k > 0) y += count === 2 ? o.colGap : o.size * o.lineHeight * 0.55;
      const kicker = paragraph.role === 'kicker';
      const highlight = paragraph.role === 'highlight';
      const size = kicker ? o.size * o.kickerScale : o.size;
      const lineHeight = size * (kicker ? 1.1 : o.lineHeight);
      const gap = highlight ? 0 : o.wordGap * size;
      const pad = highlight ? HIGHLIGHT_PAD * size : 0;
      const top = y;

      for (const forced of paragraph.lines) {
        const widths = forced.map((token) => (o.measure(token.text, paragraph.lang) * size) / 100 + pad * 2);
        // The space before each word (none before the first of a line, nor inside Chinese or Japanese).
        const gaps = forced.map((token) => (token.glued ? 0 : gap));
        if (widths.some((w) => w > colWidth + 0.5)) result.fits = false;

        // Greedy wrap.
        const rows: number[][] = [];
        let row: number[] = [];
        let rowWidth = 0;
        widths.forEach((w, i) => {
          if (row.length > 0 && rowWidth + gaps[i] + w > colWidth) {
            rows.push(row);
            row = [];
            rowWidth = 0;
          }
          rowWidth += (row.length > 0 ? gaps[i] : 0) + w;
          row.push(i);
        });
        if (row.length > 0) rows.push(row);

        for (const r of rows) {
          const used = r.reduce((sum, i, n) => sum + widths[i] + (n > 0 ? gaps[i] : 0), 0);
          // Alignment is by reading direction: "left" means the start of the line, so it's the right in Arabic.
          const align = paragraph.rtl && o.align !== 'center' ? (o.align === 'left' ? 'right' : 'left') : o.align;
          let cursor = x0 + (align === 'center' ? (colWidth - used) / 2 : align === 'right' ? colWidth - used : 0);
          const order = visualOrder(
            r.map((i) => direction(forced[i].text)),
            paragraph.rtl,
          ).map((n) => r[n]);
          order.forEach((i, n) => {
            // The space between two neighbors belongs to the later one in reading order.
            if (n > 0) cursor += gaps[Math.max(i, order[n - 1])];
            result.words.push({
              text: forced[i].text,
              x: cursor + pad,
              y,
              width: widths[i] - pad * 2,
              size,
              lineHeight,
              role: paragraph.role,
              index: index + r.indexOf(i),
              rtl: paragraph.rtl,
              ...(paragraph.lang ? { lang: paragraph.lang } : {}),
            });
            if (highlight) result.marks.push({ x: cursor, y: y + lineHeight * 0.12, width: widths[i], height: lineHeight * 0.78 });
            cursor += widths[i];
          });
          index += r.length;
          if (paragraph.role === 'body') result.lines.push({ y, height: lineHeight });
          y += lineHeight;
        }
      }
      result.boxes.push({ x: x0, y: top, width: colWidth, height: y - top, role: paragraph.role });
    });
    result.height = Math.max(result.height, y);
  });

  return result;
}
