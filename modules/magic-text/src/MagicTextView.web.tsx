import * as React from 'react';

import { MagicTextViewProps } from './MagicText.types';

export default function MagicTextView(props: MagicTextViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
