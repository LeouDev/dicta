/**
 * What `@shopify/react-native-skia` means inside the website's card renderer:
 * the package's own web build (CanvasKit), with the same components and API
 * the app draws with. build.mjs points the bare import here, and the bundle
 * loads CanvasKit before any of this runs.
 */
export * from '@shopify/react-native-skia/lib/module/renderer/components';
export * from '@shopify/react-native-skia/lib/module/skia';
