// Reexport the native module. On web, it will be resolved to MagicTextModule.web.ts
// and on native platforms to MagicTextModule.ts
export { default } from './src/MagicTextModule';
export { default as MagicTextView } from './src/MagicTextView';
export * from  './src/MagicText.types';
