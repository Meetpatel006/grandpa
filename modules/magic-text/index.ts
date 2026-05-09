// Reexport the native module. On web, it will be resolved to MagicTextModule.web.ts
// and on native platforms to MagicTextModule.ts.
//
// Do not re-export MagicTextView here. The app only needs module functions, and
// loading requireNativeView('MagicText') without registering a native View(...)
// causes Expo's NativeViewManagerAdapter warning on Android.
export { default } from "./src/MagicTextModule";
export * from "./src/MagicText.types";
