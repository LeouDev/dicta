import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useEffect } from 'react';

import { toast } from '@/components/toast';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/services/errors';
import {
  acceptConversation,
  clearConversation,
  fetchChat,
  fetchConversations,
  fetchMessage,
  fetchMessages,
  fetchOtherLastRead,
  markConversationRead,
  sendMessage,
  setConversationMuted,
  unsendMessage,
  type NewMessage,
} from '@/services/messages';
import { selectUserId, useAuth } from '@/store/auth';
import type { Conversation, Message } from '@/types/models';

type Pages = InfiniteData<Message[], string | null>;

export function useConversations() {
  const userId = useAuth(selectUserId);
  return useQuery({ queryKey: queryKeys.conversations(userId), queryFn: () => fetchConversations(userId!), enabled: userId !== null });
}

/** Unread chats (for the badge on Home), and how many requests are waiting. */
export function useUnreadMessages() {
  const { data } = useConversations();
  return {
    unread: data?.filter((c) => c.accepted && c.unread).length ?? 0,
    requests: data?.filter((c) => !c.accepted).length ?? 0,
  };
}

/** A chat's messages, newest first in pages (the list shows them bottom-up). */
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: ({ pageParam }) => fetchMessages(conversationId, pageParam),
    initialPageParam: null as string | null,
    // Asks for more until a page comes back empty: sending, receiving and unsending change a page's length.
    getNextPageParam: (page) => page.at(-1)?.createdAt,
  });
}

/** Who the chat is with, and whether it's still in your requests. */
export function useChat(conversationId: string) {
  const userId = useAuth(selectUserId);
  return useQuery({ queryKey: queryKeys.chat(conversationId), queryFn: () => fetchChat(conversationId, userId!), enabled: userId !== null });
}

/** When the other person last read this chat, kept live by useConversationRealtime. */
export function useOtherLastRead(conversationId: string) {
  const userId = useAuth(selectUserId);
  return useQuery({
    queryKey: queryKeys.otherLastRead(conversationId),
    queryFn: () => fetchOtherLastRead(conversationId, userId!),
    enabled: userId !== null,
  });
}

/**
 * Puts a message in the newest page, in time order, once: a live event and our own insert can race, and
 * live messages arrive after a fetch that can finish out of order.
 */
export function addMessage(client: QueryClient, message: Message, replacing?: string) {
  client.setQueryData<Pages>(queryKeys.messages(message.conversationId), (data) => {
    if (!data) return data;
    const pages = data.pages.map((page) => page.filter((m) => m.id !== replacing && m.id !== message.id));
    const newest = pages[0] ?? [];
    const at = newest.findIndex((m) => Date.parse(m.createdAt) < Date.parse(message.createdAt));
    const placed = at < 0 ? [...newest, message] : [...newest.slice(0, at), message, ...newest.slice(at)];
    return { ...data, pages: [placed, ...pages.slice(1)] };
  });
}

function patchMessage(client: QueryClient, conversationId: string, id: string, update: (m: Message) => Message | null) {
  client.setQueryData<Pages>(queryKeys.messages(conversationId), (data) =>
    data
      ? { ...data, pages: data.pages.map((page) => page.flatMap((m) => (m.id === id ? (update(m) ?? []) : [m]))) }
      : data,
  );
}

/** Sends right away on screen; a failed message stays, marked, to retry or delete. */
export function useSendMessage(conversationId: string) {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  return useMutation({
    mutationFn: (input: Omit<NewMessage, 'conversationId' | 'senderId'> & { tempId: string }) =>
      sendMessage({ ...input, conversationId, senderId: userId! }),
    onMutate: ({ tempId, body, postId, storyId }) => {
      addMessage(client, {
        id: tempId,
        conversationId,
        senderId: userId!,
        body: body?.trim() || null,
        postId: postId ?? null,
        post: null,
        storyId: storyId ?? null,
        story: null,
        createdAt: new Date().toISOString(),
        status: 'sending',
      });
    },
    onSuccess: (message, { tempId }) => {
      addMessage(client, message, tempId);
      client.invalidateQueries({ queryKey: queryKeys.conversations(userId) });
    },
    onError: (error, { tempId }) => {
      patchMessage(client, conversationId, tempId, (m) => ({ ...m, status: 'failed' }));
      toast(friendlyError(error, 'Couldn’t send the message.'));
    },
  });
}

export const newMessageId = () => `local-${Crypto.randomUUID()}`;

export function useUnsendMessage(conversationId: string) {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  return useMutation({
    mutationFn: (message: Message) => (message.status ? Promise.resolve() : unsendMessage(message.id)),
    onMutate: (message) => patchMessage(client, conversationId, message.id, () => null),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.conversations(userId) }),
    onError: (error) => {
      client.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
      toast(friendlyError(error, 'Couldn’t unsend the message.'));
    },
  });
}

/** Marks the chat read (clears its unread dot and tells the other person it was seen). */
export function useMarkConversationRead(conversationId: string) {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  return useMutation({
    mutationFn: () => markConversationRead(conversationId, userId!),
    onMutate: () => {
      const now = new Date().toISOString();
      client.setQueryData<Conversation[]>(queryKeys.conversations(userId), (list) =>
        list?.map((c) => (c.id === conversationId ? { ...c, lastReadAt: now, unread: false } : c)),
      );
    },
    // A refetch that started before the server saved the read would bring the dot back.
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.conversations(userId) }),
  });
}

/** Accept a request, mute, or clear a chat (for you only). */
export function useConversationActions(conversationId: string) {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  const patch = (update: (c: Conversation) => Conversation | null) =>
    client.setQueryData<Conversation[]>(queryKeys.conversations(userId), (list) =>
      list?.flatMap((c) => (c.id === conversationId ? (update(c) ?? []) : [c])),
    );
  const done = {
    onSettled: () => {
      client.invalidateQueries({ queryKey: queryKeys.conversations(userId) });
      client.invalidateQueries({ queryKey: queryKeys.chat(conversationId) });
    },
  };
  return {
    accept: useMutation({
      mutationFn: () => acceptConversation(conversationId, userId!),
      onMutate: () => patch((c) => ({ ...c, accepted: true })),
      onError: (error: unknown) => toast(friendlyError(error, 'Couldn’t accept the request.')),
      ...done,
    }),
    mute: useMutation({
      mutationFn: (muted: boolean) => setConversationMuted(conversationId, userId!, muted),
      onMutate: (muted: boolean) => patch((c) => ({ ...c, muted })),
      onSuccess: (_data: void, muted: boolean) => toast(muted ? 'Muted. You won’t get notifications for this chat.' : 'Unmuted'),
      onError: (error: unknown) => toast(friendlyError(error, 'Couldn’t update the chat.')),
      ...done,
    }),
    clear: useMutation({
      mutationFn: () => clearConversation(conversationId, userId!),
      onMutate: () => {
        patch(() => null);
        client.removeQueries({ queryKey: queryKeys.messages(conversationId) });
      },
      onError: (error: unknown) => toast(friendlyError(error, 'Couldn’t delete the chat.')),
      ...done,
    }),
  };
}

/**
 * Live messages everywhere: a new message refreshes the inbox and the Home
 * badge, and lands in its chat if that chat is open (RLS decides what arrives).
 */
export function useMessagesRealtime() {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`messages:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        client.invalidateQueries({ queryKey: queryKeys.conversations(userId) });
        const row = payload.new as { id: string; conversation_id: string };
        if (!client.getQueryData(queryKeys.messages(row.conversation_id))) return;
        const message = await fetchMessage(row.id).catch(() => null);
        if (message) addMessage(client, message);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [client, userId]);
}

let chatChannels = 0;

/** While a chat is open: the other person reading it updates "Seen". */
export function useConversationRealtime(conversationId: string) {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      // A channel of its own: the same chat can be open twice in the stack, and a reused, joined channel throws on .on().
      .channel(`conversation:${conversationId}:${++chatChannels}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { user_id: string; last_read_at: string | null };
          if (row.user_id !== userId) client.setQueryData(queryKeys.otherLastRead(conversationId), row.last_read_at);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [client, conversationId, userId]);
}
