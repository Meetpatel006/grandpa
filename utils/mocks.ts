export const mockSenderData = {
  inviteCode: "TEST12",
  adminLabel: "Test Sender",
  groupId: "mock-group-123" as any,
  lastCommandAt: Date.now() - 300000,
  receivers: [
    {
      deviceId: "receiver-1",
      label: "Living Room Phone",
      phoneNumbers: ["+1 555 123 4567", "+1 555 987 6543"],
      online: true,
      connectionState: "connected",
      joinedAt: Date.now() - 3600000,
      lastHandledCommandToken: "cmd-abc",
      lastHandledAt: Date.now() - 1800000,
      lastHeartbeatAt: Date.now() - 5000,
    },
    {
      deviceId: "receiver-2",
      label: "Kitchen Phone",
      phoneNumbers: ["+1 555 456 7890"],
      online: true,
      connectionState: "connected",
      joinedAt: Date.now() - 7200000,
      lastHandledCommandToken: null,
      lastHandledAt: null,
      lastHeartbeatAt: Date.now() - 10000,
    },
    {
      deviceId: "receiver-3",
      label: "Bedroom Phone",
      phoneNumbers: [],
      online: false,
      connectionState: "background",
      joinedAt: Date.now() - 10800000,
      lastHandledCommandToken: null,
      lastHandledAt: null,
      lastHeartbeatAt: Date.now() - 60000,
    },
  ],
};

export const mockReceiverData = {
  inviteCode: "TEST12",
  adminLabel: "Test Sender",
  groupId: "mock-group-123" as any,
  receiverLabel: "Living Room Phone",
  vipNumbers: ["+15551234567", "+15559876543"],
  magicKeyword: "#UNMUTE#",
  lastTriggerAt: null,
  lastTriggerSource: null,
  lastHandledCommandToken: null,
  latestCommand: null,
};

export const mockReceiverSession = {
  inviteCode: "TEST12",
  adminLabel: "Test Sender",
  groupId: "mock-group-123" as any,
  latestCommand: {
    token: "mock-token-abc123",
    alreadyHandled: false,
  },
};

export const mockNoSession = null;

export function setMockMode(mode: "sender" | "receiver" | null) {
  if (typeof window !== "undefined") {
    (window as any).__mockMode = mode;
  }
}

export function getMockMode(): "sender" | "receiver" | null {
  if (typeof window !== "undefined") {
    return (window as any).__mockMode;
  }
  return null;
}