import { NativeModule, requireNativeModule } from 'expo';

import { VolumeModuleEvents } from './Volume.types';

declare class VolumeModule extends NativeModule<VolumeModuleEvents> {
  unmutePhone(): void;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<VolumeModule>('Volume');
