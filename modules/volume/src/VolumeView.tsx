import { requireNativeView } from 'expo';
import * as React from 'react';

import { VolumeViewProps } from './Volume.types';

const NativeView: React.ComponentType<VolumeViewProps> =
  requireNativeView('Volume');

export default function VolumeView(props: VolumeViewProps) {
  return <NativeView {...props} />;
}
