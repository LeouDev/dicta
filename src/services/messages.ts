import { parseQuoteDesign } from '@/features/quote-card/serialize';
import { supabase } from '@/lib/supabase';
import type { Conversation, Message, PostAuthor } from '@/types/models';

import { AUTHOR_SELECT, toAuthor } from './author';

/*
 * Direct messages: one-to-one chats. The database lets only the two people in
 * a chat read it, never across a block, files a chat from someone you don't
 * follow under requests, and pushes new messages in accepted, unmuted chats.
 */

export const MESSAGE_PAGE = 40;
export const MESSAGE_MAX_LENGTH = 1000;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Your chats, newest message first. */
export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('my_conversations');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.conversation_id,
    accepted: row.accepted,
    muted: row.muted,
    lastReadAt: row.last_read_at,
    other: toAuthor({
      id: row.other_id,
      username: row.other_username,
      display_name: row.other_display_name,
      avatar_url: row.other_avatar_url,
      is_verified: row.other_is_verified,
    }),
    otherLastReadAt: row.other_last_read_at,
    last: {
      id: row.last_message_id,
      senderId: row.last_sender_id,
      body: row.last_body,
      postId: row.last_post_id,
      storyId: row.last_story_id,
      createdAt: row.last_message_at,
    },
    unread: row.last_sender_id !== userId && (!row.last_read_at || row.last_message_at > row.last_read_at),
  }));
}

export interface ChatInfo {
  other: PostAuthor;
  /** False while it's in your requests. */
  accepted: boolean;
  muted: boolean;
}

/** Who a chat is with and your side of it, even before it has any messages (the inbox lists chats with messages only). */
export async function fetchChat(conversationId: string, userId: string): Promise<ChatInfo | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      `user_a, a:profiles!conversations_user_a_fkey(${AUTHOR_SELECT}), b:profiles!conversations_user_b_fkey(${AUTHOR_SELECT}), ` +
        'members:conversation_members(user_id, accepted, muted)',
    )
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as {
    user_a: string;
    a: Record<string, unknown> | null;
    b: Record<string, unknown> | null;
    members: { user_id: string; accepted: boolean; muted: boolean }[];
  };
  const other = row.user_a === userId ? row.b : row.a;
  const mine = row.members.find((m) => m.user_id === userId);
  return other ? { other: toAuthor(other), accepted: mine?.accepted ?? true, muted: mine?.muted ?? false } : null;
}

/** The chat with someone, made the first time (it lands in their requests unless they follow you). */
export async function startConversation(userId: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation', { p_user: userId });
  if (error) throw error;
  return data;
}

const MESSAGE_SELECT =
  'id, conversation_id, sender_id, body, post_id, story_id, created_at, ' +
  `post:posts(id, text, author:profiles!posts_author_id_fkey(${AUTHOR_SELECT}), design:post_designs(design)), ` +
  'story:stories(id, text, design)';

export function toMessage(row: unknown): Message | null {
  if (!isRecord(row)) return null;
  const post = isRecord(row.post) && isRecord(row.post.author) ? row.post : null;
  const designRow = post ? (Array.isArray(post.design) ? post.design[0] : post.design) : null;
  const story = isRecord(row.story) ? row.story : null;
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: String(row.sender_id),
    body: typeof row.body === 'string' ? row.body : null,
    postId: typeof row.post_id === 'string' ? row.post_id : null,
    post: post
      ? {
          id: String(post.id),
          text: String(post.text ?? ''),
          author: toAuthor(post.author as Record<string, unknown>),
          design: parseQuoteDesign(isRecord(designRow) ? designRow.design : null),
        }
      : null,
    storyId: typeof row.story_id === 'string' ? row.story_id : null,
    story: story ? { id: String(story.id), text: String(story.text ?? ''), design: parseQuoteDesign(story.design) } : null,
    createdAt: String(row.created_at),
  };
}

/** A chat's messages, newest first (the list shows them bottom-up), a page before `before`. */
export async function fetchMessages(conversationId: string, before: string | null): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_PAGE);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown[]).map(toMessage).filter((m): m is Message => m !== null);
}

/** One message as stored, with its quote or story (for live updates). */
export async function fetchMessage(id: string): Promise<Message | null> {
  const { data, error } = await supabase.from('messages').select(MESSAGE_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return toMessage(data);
}

export interface NewMessage {
  conversationId: string;
  senderId: string;
  body?: string | null;
  postId?: string | null;
  storyId?: string | null;
}

export async function sendMessage({ conversationId, senderId, body, postId, storyId }: NewMessage): Promise<Message> {
  const text = body?.trim() || null;
  if (!text && !postId && !storyId) throw new Error('Write a message first.');
  if (text && text.length > MESSAGE_MAX_LENGTH) throw new Error(`Keep it under ${MESSAGE_MAX_LENGTH} characters.`);
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body: text, post_id: postId ?? null, story_id: storyId ?? null })
    .select(MESSAGE_SELECT)
    .single();
  if (error) throw error;
  return toMessage(data)!;
}

/** Takes back one of your messages, for both of you. */
export async function unsendMessage(id: string) {
  const { error } = await supabase.from('messages').delete().eq('id', id);
  if (error) throw error;
}

/** Your side of a chat: read, accepted (out of requests), cleared, muted. */
async function updateMySide(conversationId: string, userId: string, changes: { last_read_at?: string; accepted?: boolean; cleared_at?: string; muted?: boolean }) {
  const { error } = await supabase.from('conversation_members').update(changes).eq('conversation_id', conversationId).eq('user_id', userId);
  if (error) throw error;
}

export const markConversationRead = (conversationId: string, userId: string) =>
  updateMySide(conversationId, userId, { last_read_at: new Date().toISOString() });
export const acceptConversation = (conversationId: string, userId: string) => updateMySide(conversationId, userId, { accepted: true });
/** Clears the chat for you only; it comes back with the next message. */
export const clearConversation = (conversationId: string, userId: string) =>
  updateMySide(conversationId, userId, { cleared_at: new Date().toISOString() });
export const setConversationMuted = (conversationId: string, userId: string, muted: boolean) => updateMySide(conversationId, userId, { muted });

/** When the other person last read the chat (for "Seen"). */
export async function fetchOtherLastRead(conversationId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('last_read_at')
    .eq('conversation_id', conversationId)
    .neq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.last_read_at ?? null;
}

/** How a chat's last message reads in the inbox. */
export function messagePreview(last: Conversation['last'], userId: string): string {
  const mine = last.senderId === userId;
  if (last.body) return `${mine ? 'You: ' : ''}${last.body.replace(/\s+/g, ' ').trim()}`;
  if (last.postId) return mine ? 'You sent a quote' : 'Sent you a quote';
  if (last.storyId) return mine ? 'You replied to their story' : 'Replied to your story';
  return mine ? 'You sent a message' : 'Sent a message';
}
