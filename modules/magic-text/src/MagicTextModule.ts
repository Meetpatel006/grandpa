import { NativeModule, requireNativeModule } from 'expo';

import { MagicTextModuleEvents } from './MagicText.types';

declare class MagicTextModule extends NativeModule<MagicTextModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<MagicTextModule>('MagicText');
