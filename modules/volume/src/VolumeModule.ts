import { NativeModule, requireNativeModule } from 'expo';

import { VolumeModuleEvents } from './Volume.types';

declare class VolumeModule extends NativeModule<VolumeModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<VolumeModule>('Volume');
