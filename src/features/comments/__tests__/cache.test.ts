import { comment, pages } from '@/test-utils/fixtures';

import { appendComment, flattenComments, splitMentions, type CommentPages } from '../cache';

describe('appendComment', () => {
  it('starts a conversation when nothing is cached yet', () => {
    expect(appendComment(undefined, comment())).toEqual({ pages: [[comment()]], pageParams: [null] });
  });

  it('adds to the end of the last page without touching the old data', () => {
    const data = pages([comment({ id: 'a' })], [comment({ id: 'b' })]) as CommentPages;
    const next = appendComment(data, comment({ id: 'c' }));
    expect(next.pages.map((p) => p.map((c) => c.id))).toEqual([['a'], ['b', 'c']]);
    expect(data.pages[1].map((c) => c.id)).toEqual(['b']);
    expect(next.pages[0]).toBe(data.pages[0]);
  });
});

describe('flattenComments', () => {
  it('keeps order and drops a comment that shows up in two pages', () => {
    const data = pages([comment({ id: 'a' }), comment({ id: 'b' })], [comment({ id: 'b' }), comment({ id: 'c' })]);
    expect(flattenComments(data).map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(flattenComments(undefined)).toEqual([]);
  });
});

describe('splitMentions', () => {
  it('finds @mentions between plain text', () => {
    expect(splitMentions('thank you @ana and @ben_22')).toEqual([
      { text: 'thank you ', mention: false },
      { text: '@ana', mention: true },
      { text: ' and ', mention: false },
      { text: '@ben_22', mention: true },
    ]);
  });

  it('keeps sentence dots out of the handle, like the server does', () => {
    expect(splitMentions('see @mara.vell..')).toEqual([
      { text: 'see ', mention: false },
      { text: '@mara.vell', mention: true },
      { text: '..', mention: false },
    ]);
  });

  it('ignores handles that are too short and plain text', () => {
    expect(splitMentions('hi @al')).toEqual([{ text: 'hi @al', mention: false }]);
    expect(splitMentions('no mentions here')).toEqual([{ text: 'no mentions here', mention: false }]);
  });
});
