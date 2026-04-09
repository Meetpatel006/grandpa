import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './Volume.types';

type VolumeModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class VolumeModule extends NativeModule<VolumeModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(VolumeModule, 'VolumeModule');
