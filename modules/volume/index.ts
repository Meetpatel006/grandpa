// Reexport the native module. On web, it will be resolved to VolumeModule.web.ts
// and on native platforms to VolumeModule.ts
export { default } from './src/VolumeModule';
export { default as VolumeView } from './src/VolumeView';
export * from  './src/Volume.types';
