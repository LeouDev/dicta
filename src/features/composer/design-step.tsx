import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { hitTarget, shadows, spacing } from '@/constants/tokens';
import { QuoteCard } from '@/features/quote-card/quote-card';
import { CARD_FORMATS, type CardAuthor } from '@/features/quote-card/types';
import { useTheme } from '@/hooks/use-theme';

import { BackgroundPicker } from './background-picker';
import { ColorControls } from './color-controls';
import { FontPicker } from './font-picker';
import { LayoutControls } from './layout-controls';
import { ProfileControls } from './profile-controls';
import { useComposer } from './store';
import { TemplatePicker } from './template-picker';

const TABS = [
  { key: 'templates', label: 'Templates' },
  { key: 'fonts', label: 'Fonts' },
  { key: 'colors', label: 'Colors' },
  { key: 'background', label: 'Background' },
  { key: 'layout', label: 'Layout' },
  { key: 'profile', label: 'Profile' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const PANEL_HEIGHT = 268;

interface DesignStepProps {
  author: CardAuthor;
  onEditText: () => void;
  onShare: () => void;
  onPost: () => void;
  posting: boolean;
}

/** Step 2: the card is always visible and every control updates it instantly. */
export function DesignStep({ author, onEditText, onShare, onPost, posting }: DesignStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const text = useComposer((s) => s.text);
  const design = useComposer((s) => s.design);
  const [tab, setTab] = useState<TabKey>('templates');
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);

  const ratio = CARD_FORMATS[design.format].ratio;
  const cardWidth = area
    ? Math.floor(Math.min(area.width - spacing.lg * 2, (area.height - spacing.md * 2) * ratio))
    : 0;

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton onPress={onEditText} />
        <Text variant="headline">Design</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={onShare} accessibilityRole="button" accessibilityLabel="Share as image" hitSlop={8} style={styles.iconButton}>
            <Icon name="share" size={20} color={theme.text} />
          </Pressable>
          <Button label="Post" size="sm" onPress={onPost} loading={posting} accessibilityHint="Publishes your card" />
        </View>
      </View>

      <View style={styles.previewArea} onLayout={(e) => setArea(e.nativeEvent.layout)}>
        {cardWidth > 0 && (
          <Pressable onPress={onEditText} accessibilityHint="Double tap to edit the text" style={styles.cardShadow}>
            <QuoteCard text={text} design={design} author={author} width={cardWidth} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        style={[styles.tabBar, { borderTopColor: theme.hairline }]}
        accessibilityRole="tablist">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                Haptics.selectionAsync();
                setTab(t.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={styles.tab}>
              <Text variant="subhead" color={active ? 'text' : 'textTertiary'} style={active && styles.tabActive}>
                {t.label}
              </Text>
              <View style={[styles.tabIndicator, { backgroundColor: active ? theme.text : 'transparent' }]} />
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ height: PANEL_HEIGHT + insets.bottom, flexGrow: 0 }}
        contentContainerStyle={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {tab === 'templates' && <TemplatePicker author={author} />}
        {tab === 'fonts' && <FontPicker />}
        {tab === 'colors' && <ColorControls />}
        {tab === 'background' && <BackgroundPicker />}
        {tab === 'layout' && <LayoutControls />}
        {tab === 'profile' && <ProfileControls author={author} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    minHeight: hitTarget + spacing.sm,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: { width: hitTarget - 8, height: hitTarget, alignItems: 'center', justifyContent: 'center' },
  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardShadow: shadows.lifted,
  tabBar: { flexGrow: 0, borderTopWidth: StyleSheet.hairlineWidth },
  tabs: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  tab: { paddingTop: spacing.md, alignItems: 'center', gap: spacing.sm },
  tabActive: { fontWeight: '700' },
  tabIndicator: { height: 2, alignSelf: 'stretch', borderRadius: 1 },
  panel: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
});
