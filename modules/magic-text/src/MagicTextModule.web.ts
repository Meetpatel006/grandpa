import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './MagicText.types';

type MagicTextModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class MagicTextModule extends NativeModule<MagicTextModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(MagicTextModule, 'MagicTextModule');
