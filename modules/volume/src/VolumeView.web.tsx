import * as React from 'react';

import { VolumeViewProps } from './Volume.types';

export default function VolumeView(props: VolumeViewProps) {
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
