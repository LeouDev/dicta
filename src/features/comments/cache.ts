import type { InfiniteData } from '@tanstack/react-query';

import type { FeedCursor } from '@/services/posts';
import type { CommentItem } from '@/types/models';

export type CommentPages = InfiniteData<CommentItem[], FeedCursor | null>;

/** Adds a comment at the end of the loaded conversation (creating the cache if needed). */
export function appendComment(data: CommentPages | undefined, comment: CommentItem): CommentPages {
  if (!data || data.pages.length === 0) return { pages: [[comment]], pageParams: [null] };
  const pages = data.pages.slice();
  pages[pages.length - 1] = [...pages[pages.length - 1], comment];
  return { ...data, pages };
}

/** Flattens pages, dropping duplicates (a new comment can reappear in a later page). */
export function flattenComments(data: { pages: CommentItem[][] } | undefined): CommentItem[] {
  const seen = new Set<string>();
  const out: CommentItem[] = [];
  for (const page of data?.pages ?? []) {
    for (const comment of page) {
      if (seen.has(comment.id)) continue;
      seen.add(comment.id);
      out.push(comment);
    }
  }
  return out;
}

/** Splits text into plain runs and @mentions, for highlighting. */
export function splitMentions(text: string): { text: string; mention: boolean }[] {
  const parts: { text: string; mention: boolean }[] = [];
  const pattern = /@[a-z0-9_.]{3,30}/gi;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start), mention: false });
    // Trailing dots end the sentence, not the handle (the server trims them the same way).
    const handle = match[0].replace(/\.+$/, '');
    parts.push({ text: handle, mention: true });
    if (handle.length < match[0].length) parts.push({ text: match[0].slice(handle.length), mention: false });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mention: false });
  return parts;
}
