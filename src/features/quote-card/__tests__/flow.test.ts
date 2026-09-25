import { compose, flowColumns, splitParagraphs, visualOrder, type FlowOptions, type Token } from '../flow';

// Every character is 50 units wide at 100px, so a word of n letters is n × size / 2 px.
const options = (o: Partial<FlowOptions> = {}): FlowOptions => ({
  size: 100,
  width: 1000,
  colGap: 0,
  lineHeight: 1,
  kickerScale: 0.36,
  align: 'left',
  wordGap: 0.25,
  measure: (word) => word.length * 50,
  ...o,
});
/** Token lines as plain words, for readable expectations. */
const texts = (lines: Token[][]) => lines.map((line) => line.map((t) => t.text));
const roles = (column: { role: string; lines: Token[][] }[]) => column.map((p) => ({ role: p.role, lines: texts(p.lines) }));

const design = (composition: 'flow' | 'kicker' | 'columns' | 'highlight', extra = {}) => ({
  composition,
  textTransform: 'none' as const,
  secondTransform: null,
  ...extra,
});

describe('splitParagraphs', () => {
  it('splits on blank lines and keeps single newlines as forced breaks', () => {
    expect(splitParagraphs('  one two\nthree\n\n\n four  ').map((p) => texts(p.lines))).toEqual([[['one', 'two'], ['three']], [['four']]]);
    expect(splitParagraphs(' \n\n ')).toEqual([]);
  });

  it('breaks Chinese and Japanese between characters, glued, keeping punctuation where it belongs', () => {
    const [zh] = splitParagraphs('每一天都是新的开始。');
    expect(texts(zh.lines)).toEqual([['每', '一', '天', '都', '是', '新', '的', '开', '始。']]);
    expect(zh.lines[0].map((t) => t.glued)).toEqual([false, true, true, true, true, true, true, true, true]);
    expect(zh.lang).toBe('zh');
    const [ja] = splitParagraphs('「今日も」新しい、iPhoneで。');
    expect(texts(ja.lines)).toEqual([['「今', '日', 'も」', '新', 'し', 'い、', 'iPhone', 'で。']]);
    expect(ja.lang).toBe('ja');
  });

  it('keeps Korean and spaced scripts as words, and finds right-to-left paragraphs', () => {
    const [ko] = splitParagraphs('오늘은 새로운 시작이다.');
    expect(texts(ko.lines)).toEqual([['오늘은', '새로운', '시작이다.']]);
    expect(ko).toMatchObject({ rtl: false, lang: 'ko' });
    const [ar] = splitParagraphs('كل يوم هو بداية جديدة.');
    expect(ar).toMatchObject({ rtl: true, lang: 'ar' });
    const [ru] = splitParagraphs('Каждый день — новое начало.');
    expect(ru.rtl).toBe(false);
    expect(ru.lang).toBeUndefined();
  });
});

describe('visualOrder', () => {
  it('leaves left-to-right lines alone', () => {
    expect(visualOrder([false, false, null, false], false)).toEqual([0, 1, 2, 3]);
  });

  it('reverses right-to-left lines, keeping embedded left-to-right runs in order', () => {
    expect(visualOrder([true, true, true], true)).toEqual([2, 1, 0]);
    // r0 r1 L2 L3 r4 reads, from the left: r4 L2 L3 r1 r0.
    expect(visualOrder([true, true, false, false, true], true)).toEqual([4, 2, 3, 1, 0]);
    // A neutral between two LTR words joins them; at a boundary it takes the paragraph's direction.
    expect(visualOrder([true, false, null, false], true)).toEqual([1, 2, 3, 0]);
  });

  it('reverses right-to-left runs inside left-to-right lines', () => {
    expect(visualOrder([false, true, true, false], false)).toEqual([0, 2, 1, 3]);
  });
});

describe('compose', () => {
  it('uses the first paragraph as the kicker, else the first line, else through a colon', () => {
    const [a] = compose(design('kicker'), splitParagraphs('small\n\nBIG TEXT'));
    expect(a.map((p) => p.role)).toEqual(['kicker', 'body']);
    const [b] = compose(design('kicker'), splitParagraphs('small\nbig text'));
    expect(roles(b)[0]).toEqual({ role: 'kicker', lines: [['small']] });
    const [c] = compose(design('kicker'), splitParagraphs('Note to self: rest'));
    expect(roles(c)).toEqual([
      { role: 'kicker', lines: [['Note', 'to', 'self:']] },
      { role: 'body', lines: [['rest']] },
    ]);
    const [d] = compose(design('kicker'), splitParagraphs('no kicker here'));
    expect(d.map((p) => p.role)).toEqual(['body']);
  });

  it('splits one paragraph in half for columns, casing the second column on its own', () => {
    const cols = compose(design('columns', { secondTransform: 'uppercase' }), splitParagraphs('a b c d e'));
    expect(texts(cols[0][0].lines)).toEqual([['a', 'b', 'c']]);
    expect(texts(cols[1][0].lines)).toEqual([['D', 'E']]);
    const two = compose(design('columns'), splitParagraphs('still\n\nhere'));
    expect(two.map((c) => texts(c[0].lines))).toEqual([[['still']], [['here']]]);
  });

  it('highlights the first paragraph; the case applies to all text', () => {
    const [col] = compose(design('highlight', { textTransform: 'uppercase' }), splitParagraphs('mark this\n\nnot this'));
    expect(roles(col)).toEqual([
      { role: 'highlight', lines: [['MARK', 'THIS']] },
      { role: 'body', lines: [['NOT', 'THIS']] },
    ]);
  });
});

describe('flowColumns', () => {
  it('wraps greedily and aligns rows', () => {
    // "aaaa" = 200px, gap 25px: four fit in 875px, the fifth wraps.
    const r = flowColumns(compose(design('flow'), splitParagraphs('aaaa aaaa aaaa aaaa aaaa')), options({ width: 900 }));
    expect(r.words.map((w) => w.y)).toEqual([0, 0, 0, 0, 100]);
    expect(r.height).toBe(200);
    expect(r.fits).toBe(true);
    const centered = flowColumns(compose(design('flow'), splitParagraphs('aaaa')), options({ align: 'center' }));
    expect(centered.words[0].x).toBe(400);
    const right = flowColumns(compose(design('flow'), splitParagraphs('aaaa')), options({ align: 'right' }));
    expect(right.words[0].x).toBe(800);
  });

  it('numbers words in reading order and gaps paragraphs by 0.55 lines', () => {
    const r = flowColumns(compose(design('flow'), splitParagraphs('a b\n\nc')), options({ lineHeight: 1.2 }));
    expect(r.words.map((w) => w.index)).toEqual([0, 1, 2]);
    expect(r.words[2].y).toBeCloseTo(120 + 100 * 1.2 * 0.55);
    expect(r.boxes).toHaveLength(2);
  });

  it('sets the kicker small with tight leading', () => {
    const r = flowColumns(compose(design('kicker'), splitParagraphs('small\n\nbig')), options());
    expect(r.words[0]).toMatchObject({ role: 'kicker', size: 36, lineHeight: 36 * 1.1 });
    expect(r.words[1].size).toBe(100);
  });

  it('lays two columns side by side with colGap', () => {
    const r = flowColumns(compose(design('columns'), splitParagraphs('aa\n\nbb')), options({ colGap: 100 }));
    expect(r.words.map((w) => [w.x, w.y])).toEqual([
      [0, 0],
      [550, 0],
    ]);
  });

  it('widens the gutter to a minimum without spacing paragraphs further apart', () => {
    const r = flowColumns(compose(design('columns'), splitParagraphs('aa\n\nbb\n\ncc')), options({ minColumnGap: 200 }));
    expect(r.words.map((w) => [w.x, w.y])).toEqual([
      [0, 0],
      [600, 0],
      [600, 100],
    ]);
  });

  it('marks highlight words with padding and no word gap', () => {
    const r = flowColumns(compose(design('highlight'), splitParagraphs('ab cd')), options());
    expect(r.marks).toHaveLength(2);
    expect(r.marks[0]).toEqual({ x: 0, y: 12, width: 100 + 28, height: 78 });
    expect(r.marks[1].x).toBe(128);
    expect(r.words[0].x).toBeCloseTo(14);
  });

  it('wraps Chinese between characters without word gaps, never starting a line with punctuation', () => {
    // Each character is 50 px at 100 px: 10 fit in 500 px, and "始。" (100 px) moves down whole.
    const r = flowColumns(compose(design('flow'), splitParagraphs('每一天都是新的开始。')), options({ width: 450 }));
    expect(r.fits).toBe(true);
    expect(r.words.map((w) => w.x)).toEqual([0, 50, 100, 150, 200, 250, 300, 350, 0]);
    expect(r.words.at(-1)).toMatchObject({ text: '始。', y: 100, lang: 'zh' });
  });

  it('runs Arabic lines from the right, aligned to their start', () => {
    const r = flowColumns(compose(design('flow'), splitParagraphs('ab cde f')), options({ align: 'left' }));
    expect(r.words.map((w) => w.x)).toEqual([0, 125, 300]);
    const ar = flowColumns(compose(design('flow'), splitParagraphs('كل يوم هو')), options({ align: 'left', width: 1000 }));
    // Widths 100, 150, 100 and gaps of 25 make 400 px; "left" is the right edge in Arabic.
    expect(ar.words.map((w) => [w.text, w.x, w.rtl])).toEqual([
      ['هو', 600, true],
      ['يوم', 725, true],
      ['كل', 900, true],
    ]);
    expect(ar.words.map((w) => w.index)).toEqual([2, 1, 0]);
  });

  it('reports words too wide for the column', () => {
    expect(flowColumns(compose(design('flow'), splitParagraphs('extraordinarily')), options({ width: 300 })).fits).toBe(false);
  });
});
