import { ActionSheetIOS, Alert, Platform } from 'react-native';

export interface SheetAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

/** Native iOS action sheet (Cancel is added automatically); a simple alert elsewhere. */
export function showActions(actions: SheetAction[], title?: string, onCancel?: () => void) {
  if (Platform.OS === 'ios') {
    const destructive = actions.findIndex((a) => a.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...actions.map((a) => a.label), 'Cancel'],
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: destructive >= 0 ? destructive : undefined,
      },
      (index) => (index === actions.length ? onCancel?.() : actions[index]?.onPress()),
    );
    return;
  }
  Alert.alert(title ?? '', undefined, [
    ...actions.map((a) => ({ text: a.label, style: a.destructive ? ('destructive' as const) : ('default' as const), onPress: a.onPress })),
    { text: 'Cancel', style: 'cancel' as const, onPress: onCancel },
  ]);
}

export function confirm(title: string, message: string, actionLabel: string, onConfirm: () => void, onCancel?: () => void) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: onCancel },
    { text: actionLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
