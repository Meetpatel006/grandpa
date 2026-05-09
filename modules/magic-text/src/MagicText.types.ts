export type ReceiverNativeConfig = {
  groupId: string | null;
  inviteCode: string | null;
  label: string | null;
  vipNumbers: string[];
  magicKeyword: string;
  lastHandledCommandToken: string | null;
  lastTriggerAt: number | null;
  lastTriggerSource: string | null;
};

export type InstallationSnapshot = {
  deviceId: string;
  receiverConfig: ReceiverNativeConfig;
};

export type TriggerOverrideResult = {
  executed: boolean;
  source: string;
  triggeredAt: number | null;
  reason: string;
};

export type AndroidPermissionAccess = {
  granted: boolean;
};

export type LiveBridgeStatus = {
  running: boolean;
};

export type FcmTokenSnapshot = {
  token: string | null;
};

export type MagicTextViewProps = {
  url: string;
  onLoad: (event: { nativeEvent: { url: string } }) => void;
};

export type MagicTextModuleEvents = Record<string, never>;
