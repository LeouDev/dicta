import { compose, flowColumns, splitParagraphs, type FlowOptions } from '../flow';

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
const design = (composition: 'flow' | 'kicker' | 'columns' | 'highlight', extra = {}) => ({
  composition,
  textTransform: 'none' as const,
  secondTransform: null,
  ...extra,
});

describe('splitParagraphs', () => {
  it('splits on blank lines and keeps single newlines as forced breaks', () => {
    expect(splitParagraphs('  one two\nthree\n\n\n four  ')).toEqual([[['one', 'two'], ['three']], [['four']]]);
    expect(splitParagraphs(' \n\n ')).toEqual([]);
  });
});

describe('compose', () => {
  it('uses the first paragraph as the kicker, else the first line, else through a colon', () => {
    const [a] = compose(design('kicker'), splitParagraphs('small\n\nBIG TEXT'));
    expect(a.map((p) => p.role)).toEqual(['kicker', 'body']);
    const [b] = compose(design('kicker'), splitParagraphs('small\nbig text'));
    expect(b[0]).toEqual({ role: 'kicker', lines: [['small']] });
    const [c] = compose(design('kicker'), splitParagraphs('Note to self: rest'));
    expect(c).toEqual([
      { role: 'kicker', lines: [['Note', 'to', 'self:']] },
      { role: 'body', lines: [['rest']] },
    ]);
    const [d] = compose(design('kicker'), splitParagraphs('no kicker here'));
    expect(d.map((p) => p.role)).toEqual(['body']);
  });

  it('splits one paragraph in half for columns, casing the second column on its own', () => {
    const cols = compose(design('columns', { secondTransform: 'uppercase' }), splitParagraphs('a b c d e'));
    expect(cols[0][0].lines).toEqual([['a', 'b', 'c']]);
    expect(cols[1][0].lines).toEqual([['D', 'E']]);
    const two = compose(design('columns'), splitParagraphs('still\n\nhere'));
    expect(two.map((c) => c[0].lines)).toEqual([[['still']], [['here']]]);
  });

  it('highlights the first paragraph; the case applies to all text', () => {
    const [col] = compose(design('highlight', { textTransform: 'uppercase' }), splitParagraphs('mark this\n\nnot this'));
    expect(col).toEqual([
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

  it('reports words too wide for the column', () => {
    expect(flowColumns(compose(design('flow'), splitParagraphs('extraordinarily')), options({ width: 300 })).fits).toBe(false);
  });
});
