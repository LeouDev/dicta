import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';

import { FollowButton } from '@/components/follow-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/user-avatar';
import { radius, spacing, typography } from '@/constants/tokens';
import { GRID_GAP, GRID_GUTTER, PostGrid } from '@/features/feed/post-grid';
import { QuoteCard } from '@/features/quote-card/quote-card';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSearchTags, useSearchUsers, useSuggestedCreators, useTopics, useTrendingTags } from '@/hooks/use-discover';
import { flattenPages, useRecentPosts, useSearchPosts, useTrendingPosts } from '@/hooks/use-posts';
import { useTheme } from '@/hooks/use-theme';
import { MIN_SEARCH_LENGTH, parseSearch } from '@/services/discover';
import type { HashtagCount, ProfileView, Topic } from '@/types/models';
import { compactNumber } from '@/utils/format';

export default function DiscoverScreen() {
  const theme = useTheme();
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Search waits for a pause in typing instead of querying on every keystroke.
  const search = parseSearch(useDebouncedValue(input, 300));
  const searching = search.query.length >= MIN_SEARCH_LENGTH;

  return (
    <Screen edges={['top']} contentStyle={styles.screen}>
      <View style={styles.header}>
        <ScreenHeader title="Discover" />
        <View style={styles.searchRow}>
          <View style={[styles.search, { backgroundColor: theme.surface }]}>
            <Icon name="search" size={16} color={theme.textTertiary} />
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Search people, quotes, #tags"
              placeholderTextColor={theme.textTertiary}
              selectionColor={theme.accent}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel="Search"
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>
          {(focused || input.length > 0) && (
            <Pressable
              onPress={() => {
                setInput('');
                inputRef.current?.blur();
              }}
              accessibilityRole="button"
              hitSlop={8}>
              <Text variant="body" color="accent">
                Cancel
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {searching ? <SearchResults query={search.query} scope={search.scope} /> : <DiscoverHome />}
    </Screen>
  );
}

/** Topics, trending quotes, creators and hashtags above a grid of the newest cards. */
function DiscoverHome() {
  const { width } = useWindowDimensions();
  const topics = useTopics();
  const trending = useTrendingPosts();
  const creators = useSuggestedCreators();
  const tags = useTrendingTags();
  const trendingPosts = flattenPages(trending.data).slice(0, 10);
  const cardWidth = Math.min(240, width * 0.58);

  const header = (
    <View style={[styles.sections, styles.bleed]}>
      {topics.data && topics.data.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {topics.data.map((t) => (
            <TopicChip key={t.slug} topic={t} />
          ))}
        </ScrollView>
      )}

      {trendingPosts.length > 0 && (
        <Section title="Trending">
          <FlatList
            horizontal
            data={trendingPosts}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            renderItem={({ item }) => (
              <PressableScale
                onPress={() => router.push(`/post/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${item.text.trim()} — by ${item.author.displayName}. Opens the post.`}
                scaleTo={0.98}>
                <QuoteCard text={item.text} design={item.design} author={item.author} width={cardWidth} radius={radius.md} />
              </PressableScale>
            )}
          />
        </Section>
      )}

      {creators.data && creators.data.length > 0 && (
        <Section title="Creators to follow">
          <FlatList
            horizontal
            data={creators.data}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            renderItem={({ item }) => <CreatorCard profile={item} />}
          />
        </Section>
      )}

      {tags.data && tags.data.length > 0 && (
        <Section title="Trending hashtags">
          <View style={styles.tagWrap}>
            {tags.data.map((t) => (
              <TagChip key={t.tag} tag={t} />
            ))}
          </View>
        </Section>
      )}

      <Text variant="overline" color="textTertiary" style={styles.sectionTitle}>
        Recent
      </Text>
    </View>
  );

  return <PostGrid query={useRecentPosts()} header={header} empty={<EmptyState title="Nothing here yet" message="New quotes will gather here." />} />;
}

function SearchResults({ query, scope }: { query: string; scope: 'all' | 'people' | 'tags' }) {
  const theme = useTheme();
  const users = useSearchUsers(query, scope !== 'tags');
  const tags = useSearchTags(query, scope !== 'people');
  const posts = useSearchPosts(scope === 'all' ? query : '');
  const needle = query.toLowerCase();
  const allTopics = useTopics().data ?? [];
  const topics = scope === 'all' ? allTopics.filter((t) => t.label.toLowerCase().includes(needle)) : [];
  const loading = (scope !== 'tags' && users.isFetching) || (scope !== 'people' && tags.isFetching);
  const people = users.data ?? [];
  const hashtags = tags.data ?? [];

  const sections = (
    <View style={[styles.sections, scope === 'all' && styles.bleed]}>
      {people.length > 0 && (
        <Section title="People">
          {people.slice(0, scope === 'people' ? 20 : 5).map((p) => (
            <PersonRow key={p.id} profile={p} />
          ))}
        </Section>
      )}
      {(hashtags.length > 0 || topics.length > 0) && (
        <Section title="Topics & hashtags">
          {topics.map((t) => (
            <ResultRow key={t.slug} icon="hashtag" title={t.label} subtitle="Topic" onPress={() => router.push(`/topic/${t.slug}`)} />
          ))}
          {hashtags.map((t) => (
            <ResultRow
              key={t.tag}
              icon="hashtag"
              title={`#${t.tag}`}
              subtitle={`${compactNumber(t.postCount)} ${t.postCount === 1 ? 'quote' : 'quotes'}`}
              onPress={() => router.push(`/tag/${t.tag}`)}
            />
          ))}
        </Section>
      )}
      {loading && people.length === 0 && hashtags.length === 0 && <ActivityIndicator color={theme.textTertiary} style={styles.loading} />}
      {scope === 'all' && (
        <Text variant="overline" color="textTertiary" style={styles.sectionTitle}>
          Quotes
        </Text>
      )}
    </View>
  );

  if (scope === 'all') {
    return <PostGrid query={posts} header={sections} empty={<EmptyState title="No quotes found" message={`Nothing matches “${query}” yet.`} />} />;
  }
  const nothing = !loading && people.length === 0 && hashtags.length === 0;
  return (
    <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.results}>
      {sections}
      {nothing && <EmptyState title="No results" message={`No ${scope === 'people' ? 'one' : 'hashtags'} match “${query}”.`} />}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" color="textTertiary" style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function TopicChip({ topic }: { topic: Topic }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/topic/${topic.slug}`)}
      accessibilityRole="link"
      style={({ pressed }) => [styles.chip, { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}>
      <Text variant="subhead">{topic.label}</Text>
    </Pressable>
  );
}

function TagChip({ tag }: { tag: HashtagCount }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/tag/${tag.tag}`)}
      accessibilityRole="link"
      accessibilityLabel={`#${tag.tag}, ${tag.postCount} ${tag.postCount === 1 ? 'quote' : 'quotes'}`}
      style={({ pressed }) => [styles.chip, { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}>
      <Text variant="subhead">#{tag.tag}</Text>
      <Text variant="caption" color="textTertiary">
        {compactNumber(tag.postCount)}
      </Text>
    </Pressable>
  );
}

function CreatorCard({ profile }: { profile: ProfileView }) {
  const theme = useTheme();
  return (
    // The card isn't one VoiceOver element, so its Follow button stays reachable.
    <Pressable
      onPress={() => router.push(`/user/${profile.username}`)}
      accessible={false}
      style={[styles.creator, { backgroundColor: theme.surface }]}>
      <UserAvatar uri={profile.avatar_url} name={profile.display_name} size={64} />
      <View
        style={styles.creatorText}
        accessible
        accessibilityRole="link"
        accessibilityLabel={`${profile.display_name}, @${profile.username}, ${profile.followers_count} followers`}>
        <Text variant="bodyStrong" numberOfLines={1} align="center">
          {profile.display_name}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1} align="center">
          @{profile.username}
        </Text>
      </View>
      <FollowButton profile={profile} size="sm" style={styles.creatorFollow} />
    </Pressable>
  );
}

function PersonRow({ profile }: { profile: ProfileView }) {
  return (
    <Pressable
      onPress={() => router.push(`/user/${profile.username}`)}
      accessible={false}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <UserAvatar uri={profile.avatar_url} name={profile.display_name} size={44} />
      <View
        style={styles.rowText}
        accessible
        accessibilityRole="link"
        accessibilityLabel={`${profile.display_name}, @${profile.username}, ${profile.followers_count} followers`}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {profile.display_name}
        </Text>
        <Text variant="subhead" color="textSecondary" numberOfLines={1}>
          @{profile.username} · {compactNumber(profile.followers_count)} {profile.followers_count === 1 ? 'follower' : 'followers'}
        </Text>
      </View>
      <FollowButton profile={profile} size="sm" />
    </Pressable>
  );
}

function ResultRow({ icon, title, subtitle, onPress }: { icon: 'hashtag'; title: string; subtitle: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={[styles.rowIcon, { backgroundColor: theme.surface }]}>
        <Icon name={icon} size={18} color={theme.textSecondary} />
      </View>
      <View style={styles.rowText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="subhead" color="textSecondary">
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 40, borderRadius: radius.md, paddingLeft: spacing.sm + 4 },
  searchInput: { ...typography.body, flex: 1, height: 40 },
  sections: { gap: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  // Inside the grid, cancel its side padding so carousels run edge to edge.
  bleed: { marginHorizontal: -(GRID_GUTTER - GRID_GAP / 2) },
  section: { gap: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.md },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  carousel: { gap: spacing.sm + 4, paddingHorizontal: spacing.md },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md },
  creator: { width: 156, alignItems: 'center', gap: spacing.sm + 4, padding: spacing.md, borderRadius: radius.lg },
  creatorText: { alignSelf: 'stretch', gap: 2 },
  creatorFollow: { alignSelf: 'stretch', minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 1 },
  loading: { paddingVertical: spacing.lg },
  results: { flexGrow: 1, paddingBottom: spacing.xxl },
});
