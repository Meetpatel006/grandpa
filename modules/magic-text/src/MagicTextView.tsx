import { requireNativeView } from 'expo';
import * as React from 'react';

import { MagicTextViewProps } from './MagicText.types';

const NativeView: React.ComponentType<MagicTextViewProps> =
  requireNativeView('MagicText');

export default function MagicTextView(props: MagicTextViewProps) {
  return <NativeView {...props} />;
}
