import { api } from "@/convex/_generated/api";
import MagicTextModule from "@/modules/magic-text";
import { useEmergency } from "@/providers/emergency-provider";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppState,
  Platform,
  PermissionsAndroid,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { mockReceiverData, mockReceiverSession } from "@/utils/mocks";

const CONVEX_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? "";
const USE_MOCK = false; // Set to true for testing with mock data
const MOCK_CONNECTED = false;

const mockReceiverConfig = {
  magicKeyword: mockReceiverData.magicKeyword,
  lastTriggerAt: mockReceiverData.lastTriggerAt,
  lastTriggerSource: mockReceiverData.lastTriggerSource,
  lastHandledCommandToken: null,
};

export default function ReceiverHomeScreen() {
  const {
    ready,
    deviceId,
    receiverConfig,
    clearReceiverConfig,
    setLastHandledCommandToken,
    triggerEmergencyOverride,
    persistRolePreference,
    refreshSnapshot,
  } = useEmergency();

  const [busyAction, setBusyAction] = useState<"leave" | null>(null);
  const [androidAccess, setAndroidAccess] = useState({
    sms: Platform.OS !== "android",
    phone: Platform.OS !== "android",
    callLog: Platform.OS !== "android",
    dnd: Platform.OS !== "android",
  });
  const [showSetup, setShowSetup] = useState(false);
  const [useMockData, setUseMockData] = useState(USE_MOCK);

  const leaveGroup = useMutation(useMockData ? "skip" as any : api.emergency.leaveGroup);
  const heartbeat = useMutation(useMockData ? "skip" as any : api.emergency.heartbeat);
  const acknowledgeCommand = useMutation(useMockData ? "skip" as any : api.emergency.acknowledgeCommand);

  const realSession = useQuery(
    useMockData ? "skip" as any : api.emergency.receiverSession,
    (ready && deviceId && !useMockData) ? { deviceId } : "skip"
  );

  const mockSession = mockReceiverSession;

  const session = useMockData ? mockSession : realSession;
  const isConnected = !!session;

  const config = useMockData ? mockReceiverConfig : receiverConfig;

  useEffect(() => {
    void persistRolePreference("receive");
  }, [persistRolePreference]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    let active = true;

    void (async () => {
      const [sms, phone, callLog, dnd] = await Promise.all([
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG),
        MagicTextModule.hasNotificationPolicyAccessAsync(),
      ]);

      if (!active) return;

      setAndroidAccess({ sms, phone, callLog, dnd: dnd.granted });
    })();

    return () => {
      active = false;
    };
  }, [refreshSnapshot]);

  useEffect(() => {
    if (!session?.groupId || !deviceId) return;

    const sendHeartbeat = (
      connectionState: "connecting" | "connected" | "background"
    ) => {
      void heartbeat({
        groupId: session.groupId,
        deviceId,
        role: "receiver",
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
  }, [deviceId, heartbeat, session?.groupId]);

  useEffect(() => {
    if (!session?.groupId || !deviceId || !session.latestCommand) return;

    const latestCommand = session.latestCommand;
    const nativeToken = receiverConfig?.lastHandledCommandToken ?? null;
    const shouldHandle =
      !latestCommand.alreadyHandled &&
      latestCommand.token !== nativeToken;

    if (!shouldHandle) return;

    let active = true;

    void (async () => {
      const result = await triggerEmergencyOverride("convex");
      if (!active || !result.executed) return;

      await setLastHandledCommandToken(latestCommand.token);
      await acknowledgeCommand({
        groupId: session.groupId,
        deviceId,
        token: latestCommand.token,
        source: "convex",
      });
    })().catch((error) => {
      Alert.alert(
        "Realtime unmute failed",
        error instanceof Error ? error.message : "Try again."
      );
    });

    return () => {
      active = false;
    };
  }, [
    acknowledgeCommand,
    deviceId,
    receiverConfig?.lastHandledCommandToken,
    session?.groupId,
    session?.latestCommand,
    setLastHandledCommandToken,
    triggerEmergencyOverride,
  ]);

  useEffect(() => {
    if (session) {
      setShowSetup(false);
    }
  }, [session]);

  useEffect(() => {
    if (Platform.OS !== "android" || !session?.groupId || !deviceId || !CONVEX_SITE_URL) {
      return;
    }

    void MagicTextModule.startLiveBridgeServiceAsync(
      session.receiverLabel || receiverConfig?.label || "Receiver device",
      deviceId,
      CONVEX_SITE_URL,
    );
  }, [deviceId, receiverConfig?.label, session?.groupId, session?.receiverLabel]);

  const requestAndroidFallbackAccess = async () => {
    if (Platform.OS !== "android") return true;

    const permissionResult = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
    ]);

    const dndAccess = await MagicTextModule.hasNotificationPolicyAccessAsync();

    const nextAccess = {
      sms:
        permissionResult[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] ===
        PermissionsAndroid.RESULTS.GRANTED,
      phone:
        permissionResult[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] ===
        PermissionsAndroid.RESULTS.GRANTED,
      callLog:
        permissionResult[PermissionsAndroid.PERMISSIONS.READ_CALL_LOG] ===
        PermissionsAndroid.RESULTS.GRANTED,
      dnd: dndAccess.granted,
    };

    setAndroidAccess(nextAccess);

    if (!nextAccess.dnd) {
      Alert.alert(
        "Allow Do Not Disturb access",
        "Android 12 requires special access to override silent mode.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open settings",
            onPress: () => {
              void MagicTextModule.openNotificationPolicyAccessSettingsAsync();
            },
          },
        ]
      );
    }

    return nextAccess.sms && nextAccess.phone;
  };

  const handleLeave = async () => {
    if (!session?.groupId || !deviceId) {
      await clearReceiverConfig();
      return;
    }

    setBusyAction("leave");
    try {
      await leaveGroup({ groupId: session.groupId, deviceId });
      await clearReceiverConfig();
    } catch (error) {
      Alert.alert("Leave failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusyAction(null);
    }
  };

  if (!ready) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading receiver profile...</Text>
      </View>
    );
  }

  if (!session && !showSetup) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroSection}>
            <Text style={styles.eyebrow}>Welcome back</Text>
            <Text style={styles.heroTitle}>Not connected</Text>
            <Text style={styles.heroSubtitle}>
              Join a sender group to receive unmute commands.
            </Text>
          </View>

          <View style={styles.quickAction}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                if (USE_MOCK) {
                  setUseMockData(true);
                } else {
                  setShowSetup(true);
                }
              }}
            >
              <Text style={styles.primaryButtonText}>
                {USE_MOCK ? "Mock data" : "Join a group"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => setUseMockData(false)}
            >
              <Text style={styles.secondaryButtonText}>Real data</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {showSetup || !session ? (
          <View style={styles.heroSection}>
            <Text style={styles.eyebrow}>Not connected</Text>
            <Text style={styles.heroTitle}>Join a group</Text>
            <Text style={styles.heroSubtitle}>
              Go to setup to connect to a sender group.
            </Text>
          </View>
        ) : (
          <View style={styles.heroSection}>
            <Text style={styles.eyebrow}>Active session</Text>
            <Text style={styles.heroTitle}>{session.inviteCode}</Text>
            <Text style={styles.heroSubtitle}>
              Connected to {session.adminLabel}
            </Text>
          </View>
        )}

        {session && !showSetup && (
          <View style={styles.contentStack}>
            {Platform.OS === "android" && (
              <View style={styles.infoPanel}>
                <Text style={styles.panelTitle}>Android access</Text>
                <View style={styles.statusRow}>
                  <Ionicons
                    name={androidAccess.sms ? "checkmark-circle" : "alert-circle"}
                    size={18}
                    color={androidAccess.sms ? "#000000" : "#666666"}
                  />
                  <Text style={styles.statusText}>SMS</Text>
                </View>
                <View style={styles.statusRow}>
                  <Ionicons
                    name={androidAccess.phone ? "checkmark-circle" : "alert-circle"}
                    size={18}
                    color={androidAccess.phone ? "#000000" : "#666666"}
                  />
                  <Text style={styles.statusText}>Phone state</Text>
                </View>
                <View style={styles.statusRow}>
                  <Ionicons
                    name={androidAccess.dnd ? "checkmark-circle" : "alert-circle"}
                    size={18}
                    color={androidAccess.dnd ? "#000000" : "#666666"}
                  />
                  <Text style={styles.statusText}>DND override</Text>
                </View>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={requestAndroidFallbackAccess}
                >
                  <Text style={styles.secondaryButtonText}>Request access</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.infoPanel}>
              <Text style={styles.panelTitle}>Status</Text>
              <View style={styles.row}>
                <Text style={styles.metaLabel}>Magic text</Text>
                <Text style={styles.metaValue}>
                  {config?.magicKeyword ?? "#UNMUTE#"}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.metaLabel}>Last trigger</Text>
                <Text style={styles.metaValue}>
                  {config?.lastTriggerAt
                    ? `${config.lastTriggerSource ?? "unknown"} at ${new Date(
                        config.lastTriggerAt
                      ).toLocaleTimeString()}`
                    : "None yet"}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.metaLabel}>Latest token</Text>
                <Text style={styles.metaValue}>
                  {session?.latestCommand?.token ?? "Waiting"}
                </Text>
              </View>
            </View>

            <View style={styles.actionsPanel}>
              <Pressable
                style={[
                  styles.secondaryButton,
                  busyAction === "leave" && styles.buttonDisabled,
                ]}
                disabled={busyAction !== null}
                onPress={handleLeave}
              >
                <Text style={styles.secondaryButtonText}>
                  {busyAction === "leave" ? "Leaving..." : "Disconnect"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {showSetup && (
          <View style={styles.formPanel}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {}}
            >
              <Text style={styles.primaryButtonText}>Go to setup</Text>
            </Pressable>
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
  statusLine: {
    color: "#666666",
    fontSize: 15,
    lineHeight: 21,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  statusText: {
    color: "#000000",
    fontSize: 16,
  },
  actionsPanel: {
    gap: 12,
    marginBottom: 30,
  },
});
