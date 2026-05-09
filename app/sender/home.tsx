import { api } from "@/convex/_generated/api";
import { Link } from "expo-router";
import { useEmergency } from "@/providers/emergency-provider";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { mockSenderData } from "@/utils/mocks";

const PRESENCE_TTL_MS = 30_000;
const USE_MOCK = false; /* Set to true for testing with mock data */
const MOCK_CONNECTED = false;

const SENDER_LABELS: Record<string, string> = {
  "Primary sender": "Main caregiver or family contact",
  "Kitchen sender": "Secondary device in main living area",
  "Work sender": "Work or office device",
};

const getLabelDescription = (label: string): string => {
  const lower = label.toLowerCase();
  for (const key of Object.keys(SENDER_LABELS)) {
    if (lower.includes(key.toLowerCase())) {
      return SENDER_LABELS[key];
    }
  }
  return "This device can send emergency unmute commands";
};

export default function SenderHomeScreen() {
  const { ready, deviceId, persistRolePreference } = useEmergency();

  const [adminLabel, setAdminLabel] = useState("Primary sender");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState<"create" | "all" | "specific" | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [userConnected, setUserConnected] = useState(MOCK_CONNECTED);
  const [useMockData, setUseMockData] = useState(USE_MOCK);

  const realDashboard = useQuery(
    useMockData ? "skip" as any : api.emergency.senderDashboard,
    (ready && deviceId && !useMockData) ? { adminDeviceId: deviceId } : "skip"
  );

  const dashboard = useMockData ? mockSenderData : realDashboard;

  const createGroup = useMutation(api.emergency.createGroup);
  const sendUnmute = useAction(api.push.sendUnmuteWithPush);
  const heartbeat = useMutation(api.emergency.heartbeat);

  useEffect(() => {
    void persistRolePreference("send");
  }, [persistRolePreference]);

  useEffect(() => {
    if (!dashboard?.receivers?.length) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds((current) =>
      current.filter((deviceIdToKeep: string) =>
        dashboard.receivers.some(
          ({ deviceId: receiverId }: { deviceId: string }) => receiverId === deviceIdToKeep
        )
      )
    );
  }, [dashboard?.receivers]);

  useEffect(() => {
    if (!dashboard?.groupId || !deviceId) {
      return;
    }

    const sendHeartbeat = (
      connectionState: "connecting" | "connected" | "background"
    ) => {
      void heartbeat({
        groupId: dashboard.groupId,
        deviceId,
        role: "sender",
        connectionState,
      });
    };

    sendHeartbeat("connected");

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      sendHeartbeat(nextState === "active" ? "connected" : "background");
    });

    const interval = setInterval(() => {
      sendHeartbeat("connected");
    }, 15_000);

    return () => {
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [dashboard?.groupId, deviceId, heartbeat]);

const receivers = useMemo(() => {
    return (dashboard?.receivers ?? []).map((receiver: any) => ({
      ...receiver,
      online:
        receiver.lastHeartbeatAt !== null &&
        Date.now() - receiver.lastHeartbeatAt <= PRESENCE_TTL_MS,
    }));
  }, [dashboard?.receivers]);

  useEffect(() => {
    if (dashboard) {
      setShowSetup(false);
    }
  }, [dashboard]);

  const handleCreateGroup = async () => {
    if (!deviceId) return;
    if (!adminLabel.trim()) {
      Alert.alert("Add a sender label", "Use a clear name for the admin device.");
      return;
    }

    setBusyAction("create");
    try {
      await createGroup({
        adminDeviceId: deviceId,
        adminLabel: adminLabel.trim(),
        platform: Platform.OS,
      });
    } catch (error) {
      Alert.alert("Group setup failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleSend = async (targetMode: "all" | "specific") => {
    if (!dashboard?.groupId || !deviceId) return;

    if (targetMode === "specific" && selectedIds.length === 0) {
      Alert.alert("Select receivers", "Choose at least one receiver to target.");
      return;
    }

    setBusyAction(targetMode);
    try {
      await sendUnmute({
        groupId: dashboard.groupId,
        adminDeviceId: deviceId,
        targetMode,
        targetDeviceIds: targetMode === "all" ? [] : selectedIds,
      });
      Alert.alert(
        "Command broadcast",
        targetMode === "all"
          ? "Every connected receiver was targeted."
          : "The selected receivers were targeted."
      );
    } catch (error) {
      Alert.alert("Command failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusyAction(null);
    }
  };

  const toggleReceiver = (receiverId: string) => {
    setSelectedIds((current) =>
      current.includes(receiverId)
        ? current.filter((id) => id !== receiverId)
        : [...current, receiverId]
    );
  };

  if (!ready) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading sender device profile...</Text>
      </View>
    );
  }

  if (!dashboard && !showSetup) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroSection}>
            <Text style={styles.eyebrow}>Welcome back</Text>
            <Text style={styles.heroTitle}>No active group</Text>
            <Text style={styles.heroSubtitle}>
              Create a new group to send unmute commands to receivers.
            </Text>
          </View>

          <View style={styles.quickAction}>
            <Pressable
              style={[styles.primaryButton, busyAction === "create" && styles.buttonDisabled]}
              disabled={busyAction === "create"}
              onPress={() => {
                if (USE_MOCK) {
                  setUserConnected(true);
                } else {
                  setShowSetup(true);
                }
              }}
            >
              <Text style={styles.primaryButtonText}>
                {USE_MOCK ? "Use mock connection" : "Create new group"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {showSetup || !dashboard ? (
          <View style={styles.heroSection}>
            <Text style={styles.eyebrow}>Sender setup</Text>
            <Text style={styles.heroTitle}>Create a group</Text>
            <Text style={styles.heroSubtitle}>
              Set up a name for this sender device.
            </Text>
          </View>
        ) : (
          <View style={styles.heroSection}>
            <Text style={styles.eyebrow}>Active session</Text>
            <Text style={styles.heroTitle}>{dashboard.inviteCode}</Text>
            <Text style={styles.heroSubtitle}>
              {receivers.length} receiver{receivers.length !== 1 ? "s" : ""} connected
            </Text>
          </View>
        )}

        {(showSetup || !dashboard) && (
          <View style={styles.formPanel}>
            <Text style={styles.fieldLabel}>Sender label</Text>
            <TextInput
              value={adminLabel}
              onChangeText={setAdminLabel}
              placeholder="Primary sender"
              placeholderTextColor="#666666"
              style={styles.input}
            />
            <Text style={styles.labelHelp}>{getLabelDescription(adminLabel)}</Text>
            
            {USE_MOCK && (
              <Pressable
                style={[styles.toggleButton, useMockData && styles.toggleButtonActive]}
                onPress={() => setUseMockData(!useMockData)}
              >
                <Text style={[styles.toggleButtonText, useMockData && styles.toggleButtonTextActive]}>
                  {useMockData ? "Mock data ON" : "Mock data OFF"}
                </Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.primaryButton, busyAction === "create" && styles.buttonDisabled]}
              disabled={busyAction === "create"}
              onPress={handleCreateGroup}
            >
              <Text style={styles.primaryButtonText}>
                {busyAction === "create" ? "Creating..." : "Create group"}
              </Text>
            </Pressable>
          </View>
        )}

        {dashboard && !showSetup && (
          <View style={styles.contentStack}>
            <View style={styles.infoPanel}>
              <View style={styles.row}>
                <Text style={styles.metaLabel}>Last broadcast</Text>
                <Text style={styles.metaValue}>
                  {dashboard.lastCommandAt
                    ? new Date(dashboard.lastCommandAt).toLocaleTimeString()
                    : "None yet"}
                </Text>
              </View>
            </View>

            <View style={styles.receiversPanel}>
              <Text style={styles.panelTitle}>Connected receivers</Text>
              {receivers.length === 0 ? (
                <Text style={styles.emptyState}>
                  No receivers have joined yet. Share the invite code to connect one.
                </Text>
              ) : (
                receivers.map((receiver: any) => (
                  <Pressable
                    key={receiver.deviceId}
                    onPress={() => toggleReceiver(receiver.deviceId)}
                    style={[
                      styles.receiverRow,
                      selectedIds.includes(receiver.deviceId) &&
                        styles.receiverRowSelected,
                    ]}
                  >
                    <View style={styles.receiverCopy}>
                      <Text style={styles.receiverLabel}>{receiver.label}</Text>
                      <Text style={styles.receiverMeta}>
                        {((receiver as any).phoneNumbers?.length > 0)
                          ? (receiver as any).phoneNumbers.join(", ")
                          : "No numbers"}
                      </Text>
                      <Text style={styles.receiverMeta}>
                        {receiver.online ? "Online" : "Stale"} · {receiver.connectionState}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.selectionDot,
                        selectedIds.includes(receiver.deviceId) &&
                          styles.selectionDotActive,
                      ]}
                    />
                  </Pressable>
                ))
              )}
            </View>

            <View style={styles.actionsPanel}>
              <Pressable
                style={[styles.primaryButton, busyAction === "all" && styles.buttonDisabled]}
                disabled={busyAction !== null}
                onPress={() => handleSend("all")}
              >
                <Text style={styles.primaryButtonText}>
                  {busyAction === "all" ? "Broadcasting..." : "UNMUTE all receivers"}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryButton,
                  busyAction === "specific" && styles.buttonDisabled,
                ]}
                disabled={busyAction !== null}
                onPress={() => handleSend("specific")}
              >
                <Text style={styles.secondaryButtonText}>
                  {busyAction === "specific"
                    ? "Sending..."
                    : `UNMUTE selected (${selectedIds.length})`}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    color: "#000000",
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    padding: 24,
    gap: 20,
  },
  heroSection: {
    gap: 12,
    alignItems: "center",
    paddingVertical: 32,
  },
  eyebrow: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#000000",
    fontSize: 38,
    fontWeight: "800",
    lineHeight: 44,
    textAlign: "center",
  },
  heroSubtitle: {
    color: "#2F2F2F",
    fontSize: 17,
    lineHeight: 25,
    textAlign: "center",
    maxWidth: 380,
  },
  quickAction: {
    gap: 14,
  },
  formPanel: {
    gap: 14,
  },
  infoPanel: {
    gap: 12,
  },
  contentStack: {
    gap: 20,
  },
  receiversPanel: {
    gap: 12,
  },
  panelTitle: {
    color: "#000000",
    fontSize: 20,
    fontWeight: "700",
  },
  fieldLabel: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#000000",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    fontSize: 17,
  },
  primaryButton: {
    backgroundColor: "#000000",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#000000",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButtonText: {
    color: "#000000",
    fontSize: 17,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: {
    color: "#666666",
    fontSize: 15,
  },
  metaValue: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyState: {
    color: "#666666",
    fontSize: 15,
    lineHeight: 21,
  },
  receiverRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#000000",
    padding: 14,
  },
  receiverRowSelected: {
    borderColor: "#000000",
    backgroundColor: "#F5F5F5",
  },
  receiverCopy: {
    gap: 4,
    flex: 1,
    paddingRight: 12,
  },
  receiverLabel: {
    color: "#000000",
    fontSize: 17,
    fontWeight: "700",
  },
  receiverMeta: {
    color: "#666666",
    fontSize: 14,
  },
  selectionDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#000000",
  },
  selectionDotActive: {
    borderColor: "#000000",
    backgroundColor: "#000000",
  },
  actionsPanel: {
    gap: 12,
    marginBottom: 30,
  },
  labelHelp: {
    color: "#666666",
    fontSize: 14,
    fontStyle: "italic",
    marginTop: -10,
  },
  toggleButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#000000",
    alignSelf: "flex-start",
  },
  toggleButtonActive: {
    backgroundColor: "#000000",
  },
  toggleButtonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "600",
  },
  toggleButtonTextActive: {
    color: "#FFFFFF",
  },
});
