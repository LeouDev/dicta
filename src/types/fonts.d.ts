/** Font files the app bundles itself, like @expo-google-fonts' exports: an asset id in the app. */
declare module '*.ttf' {
  const asset: number;
  export default asset;
}
