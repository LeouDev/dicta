/**
 * Pure text flow for quote cards: paragraphs → compositions → lines → words.
 * No Skia here; the caller passes `measure`, so this runs (and is tested) anywhere.
 */
import type { Box } from './geometry';
import type { QuoteDesign, TextAlign, TextTransform } from './types';

export type Role = 'body' | 'kicker' | 'highlight';

interface FlowParagraph {
  role: Role;
  /** Forced lines (single newlines), each a list of words. */
  lines: string[][];
}

type Column = FlowParagraph[];

/** Blank lines separate paragraphs; a single newline is a forced line break. */
export function splitParagraphs(text: string): string[][][] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.split('\n').map((line) => line.trim().split(/\s+/).filter(Boolean)))
    .map((p) => p.filter((line) => line.length > 0))
    .filter((p) => p.length > 0);
}

const cased = (lines: string[][], transform: TextTransform) =>
  transform === 'uppercase' ? lines.map((line) => line.map((w) => w.toUpperCase())) : lines;

/** Kicker text: paragraph 1, or its first line, or the words through the first one ending in ":". */
function splitKicker(paragraphs: string[][][]): { kicker: string[][] | null; rest: string[][][] } {
  if (paragraphs.length > 1) return { kicker: paragraphs[0], rest: paragraphs.slice(1) };
  const only = paragraphs[0];
  if (!only) return { kicker: null, rest: [] };
  if (only.length > 1) return { kicker: [only[0]], rest: [only.slice(1)] };
  const words = only[0];
  const colon = words.findIndex((w) => w.endsWith(':'));
  if (colon >= 0 && colon < words.length - 1) return { kicker: [words.slice(0, colon + 1)], rest: [[words.slice(colon + 1)]] };
  return { kicker: null, rest: paragraphs };
}

/** Arranges paragraphs into one or two columns for the design's composition. */
export function compose(design: Pick<QuoteDesign, 'composition' | 'textTransform' | 'secondTransform'>, paragraphs: string[][][]): Column[] {
  const t = design.textTransform;
  const body = (lines: string[][], transform = t): FlowParagraph => ({ role: 'body', lines: cased(lines, transform) });

  if (design.composition === 'kicker') {
    const { kicker, rest } = splitKicker(paragraphs);
    return [[...(kicker ? [{ role: 'kicker' as const, lines: cased(kicker, t) }] : []), ...rest.map((p) => body(p))]];
  }
  if (design.composition === 'columns') {
    const second = design.secondTransform ?? t;
    if (paragraphs.length === 1) {
      const words = paragraphs[0].flat();
      const half = Math.ceil(words.length / 2);
      return [[body([words.slice(0, half)])], words.length > 1 ? [body([words.slice(half)], second)] : []];
    }
    return [[body(paragraphs[0] ?? [])], paragraphs.slice(1).map((p) => body(p, second))];
  }
  if (design.composition === 'highlight') {
    return [paragraphs.map((p, i) => (i === 0 ? { role: 'highlight' as const, lines: cased(p, t) } : body(p)))];
  }
  return [paragraphs.map((p) => body(p))];
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
  /** Advance width of a word at a 100px font size. */
  measure: (word: string) => number;
}

const HIGHLIGHT_PAD = 0.14;

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
        const widths = forced.map((word) => (o.measure(word) * size) / 100 + pad * 2);
        if (widths.some((w) => w > colWidth + 0.5)) result.fits = false;

        // Greedy wrap.
        const rows: number[][] = [];
        let row: number[] = [];
        let rowWidth = 0;
        widths.forEach((w, i) => {
          if (row.length > 0 && rowWidth + gap + w > colWidth) {
            rows.push(row);
            row = [];
            rowWidth = 0;
          }
          rowWidth += (row.length > 0 ? gap : 0) + w;
          row.push(i);
        });
        if (row.length > 0) rows.push(row);

        for (const r of rows) {
          const used = r.reduce((sum, i) => sum + widths[i], 0) + gap * (r.length - 1);
          let cursor = x0 + (o.align === 'center' ? (colWidth - used) / 2 : o.align === 'right' ? colWidth - used : 0);
          for (const i of r) {
            result.words.push({ text: forced[i], x: cursor + pad, y, width: widths[i] - pad * 2, size, lineHeight, role: paragraph.role, index: index++ });
            if (highlight) result.marks.push({ x: cursor, y: y + lineHeight * 0.12, width: widths[i], height: lineHeight * 0.78 });
            cursor += widths[i] + gap;
          }
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
