import { api } from "@/convex/_generated/api";
import { Link, useRouter } from "expo-router";
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
  TextInput,
  View,
} from "react-native";

export default function ReceiverScreen() {
  const router = useRouter();
  const {
    ready,
    deviceId,
    receiverConfig,
    saveReceiverConfig,
    clearReceiverConfig,
    setLastHandledCommandToken,
    triggerEmergencyOverride,
    persistRolePreference,
    refreshSnapshot,
  } = useEmergency();

  const [inviteCode, setInviteCode] = useState(receiverConfig?.inviteCode ?? "");
  const [receiverLabel, setReceiverLabel] = useState(receiverConfig?.label ?? "Living room phone");
  const [vipNumbersText, setVipNumbersText] = useState(
    receiverConfig?.vipNumbers.join(", ") ?? "",
  );
  const [busyAction, setBusyAction] = useState<"join" | "save" | "leave" | null>(null);
  const [androidAccess, setAndroidAccess] = useState({
    sms: Platform.OS !== "android",
    phone: Platform.OS !== "android",
    callLog: Platform.OS !== "android",
    notifications: Platform.OS !== "android",
    dnd: Platform.OS !== "android",
    liveBridge: false,
  });

  const goToNumbers = () => {
    router.push({
      pathname: "/receiver/numbers",
      params: {
        inviteCode: inviteCode || receiverConfig?.inviteCode || "",
        receiverLabel: receiverLabel || receiverConfig?.label || "",
      },
    });
  };

  const joinGroup = useMutation(api.emergency.joinGroup);
  const leaveGroup = useMutation(api.emergency.leaveGroup);
  const heartbeat = useMutation(api.emergency.heartbeat);
  const acknowledgeCommand = useMutation(api.emergency.acknowledgeCommand);

  const session = useQuery(
    api.emergency.receiverSession,
    ready && deviceId ? { deviceId } : "skip",
  );

  useEffect(() => {
    void persistRolePreference("receive");
  }, [persistRolePreference]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    let active = true;

    void (async () => {
      const [sms, phone, callLog, dnd, liveBridge] = await Promise.all([
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG),
        MagicTextModule.hasNotificationPolicyAccessAsync(),
        MagicTextModule.getLiveBridgeServiceStatusAsync(),
      ]);
      const notifications =
        Platform.Version >= 33
          ? await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
          : true;

      if (!active) {
        return;
      }

      setAndroidAccess({
        sms,
        phone,
        callLog,
        notifications,
        dnd: dnd.granted,
        liveBridge: liveBridge.running,
      });
    })();

    return () => {
      active = false;
    };
  }, [refreshSnapshot]);

  useEffect(() => {
    setInviteCode(receiverConfig?.inviteCode ?? "");
    setReceiverLabel(receiverConfig?.label ?? "Living room phone");
    setVipNumbersText(receiverConfig?.vipNumbers.join(", ") ?? "");
  }, [receiverConfig]);

  useEffect(() => {
    if (!session?.groupId || !deviceId) {
      return;
    }

    const sendHeartbeat = (connectionState: "connecting" | "connected" | "background") => {
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
    if (Platform.OS !== "android" || !session?.groupId) {
      return;
    }

    void (async () => {
      const result = await MagicTextModule.startLiveBridgeServiceAsync(
        receiverLabel.trim() || receiverConfig?.label || "Receiver device",
      );

      setAndroidAccess((current) => ({
        ...current,
        liveBridge: result.running,
      }));
    })();
  }, [receiverConfig?.label, receiverLabel, session?.groupId]);

  useEffect(() => {
    if (!session?.groupId || !deviceId || !session.latestCommand) {
      return;
    }

    const latestCommand = session.latestCommand;

    const nativeToken = receiverConfig?.lastHandledCommandToken ?? null;
    const shouldHandle =
      !latestCommand.alreadyHandled &&
      latestCommand.token !== nativeToken;

    if (!shouldHandle) {
      return;
    }

    let active = true;

    void (async () => {
      const result = await triggerEmergencyOverride("convex");
      if (!active || !result.executed) {
        return;
      }

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
        error instanceof Error ? error.message : "Try again.",
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

  const vipNumbers = useMemo(
    () =>
      vipNumbersText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [vipNumbersText],
  );

  const requestAndroidFallbackAccess = async () => {
    if (Platform.OS !== "android") {
      return true;
    }

    const permissionResult = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      ...(Platform.Version >= 33
        ? [PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS]
        : []),
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
      notifications:
        Platform.Version < 33 ||
        permissionResult[PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS] ===
          PermissionsAndroid.RESULTS.GRANTED,
      dnd: dndAccess.granted,
      liveBridge: androidAccess.liveBridge,
    };

    setAndroidAccess(nextAccess);

    if (!nextAccess.dnd) {
      Alert.alert(
        "Allow Do Not Disturb access",
        "Android 12 requires special access to override silent mode. Tap OK to open the system settings screen for this permission.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Open settings",
            onPress: () => {
              void MagicTextModule.openNotificationPolicyAccessSettingsAsync();
            },
          },
        ],
      );
    }

    return nextAccess.sms && nextAccess.phone;
  };

  const handleJoin = async () => {
    if (!deviceId) {
      return;
    }

    if (!inviteCode.trim() || !receiverLabel.trim()) {
      Alert.alert("Missing information", "Add an invite code and receiver label.");
      return;
    }

    const normalizedInviteCode = inviteCode.trim().toUpperCase();
    if (normalizedInviteCode.length !== 6) {
      Alert.alert("Invalid code", "Invite codes are 6 characters. Use the code shown on the sender screen.");
      return;
    }

    await requestAndroidFallbackAccess();

    setBusyAction("join");
    try {
      const result = await joinGroup({
        inviteCode: normalizedInviteCode,
        deviceId,
        receiverLabel: receiverLabel.trim(),
        platform: Platform.OS,
      });

      await saveReceiverConfig({
        groupId: result.groupId,
        inviteCode: result.inviteCode,
        label: receiverLabel.trim(),
        vipNumbers,
      });
      await MagicTextModule.startLiveBridgeServiceAsync(receiverLabel.trim());

      Alert.alert(
        "Receiver connected",
        "Realtime Convex sync is active. SMS and VIP call fallbacks are stored locally, and a sticky notification will keep the live bridge alive.",
      );
    } catch (error) {
      Alert.alert("Join failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveFallbacks = async () => {
    if (!session?.groupId || !session.inviteCode || !deviceId) {
      return;
    }

    setBusyAction("save");
    try {
      await joinGroup({
        inviteCode: session.inviteCode,
        deviceId,
        receiverLabel: receiverLabel.trim(),
        platform: Platform.OS,
      });
      await saveReceiverConfig({
        groupId: session.groupId,
        inviteCode: session.inviteCode,
        label: receiverLabel.trim(),
        vipNumbers,
      });
      Alert.alert("Fallbacks saved", "VIP callers and receiver metadata are updated.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleLeave = async () => {
    if (!session?.groupId || !deviceId) {
      if (Platform.OS === "android") {
        await MagicTextModule.stopLiveBridgeServiceAsync();
      }
      await clearReceiverConfig();
      return;
    }

    setBusyAction("leave");
    try {
      await leaveGroup({ groupId: session.groupId, deviceId });
      await MagicTextModule.stopLiveBridgeServiceAsync();
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!session ? (
          <View style={styles.heroSection}>
            <Text style={styles.eyebrow}>Receiver mode</Text>
            <Text style={styles.heroTitle}>Stay ready to unmute</Text>
            <Text style={styles.heroSubtitle}>
              Join a group to receive unmute commands via Convex. SMS and VIP calls work as offline fallbacks.
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

        {!session ? (
          <View style={styles.formPanel}>
            <Text style={styles.fieldLabel}>Invite code</Text>
            <TextInput
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              placeholder="AB12CD"
              placeholderTextColor="#666666"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Receiver label</Text>
            <TextInput
              value={receiverLabel}
              onChangeText={setReceiverLabel}
              placeholder="Living room phone"
              placeholderTextColor="#666666"
              style={styles.input}
            />

            <Pressable 
              style={styles.secondaryButton}
              onPress={goToNumbers}
            >
              <Text style={styles.secondaryButtonText}>Next: Add VIP numbers</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.contentStack}>
            {Platform.OS === "android" && (
              <View style={styles.infoPanel}>
                <Text style={styles.panelTitle}>Android fallback access</Text>
                <Text style={styles.statusLine}>
                  SMS: {androidAccess.sms ? "Granted" : "Missing"}
                </Text>
                <Text style={styles.statusLine}>
                  Phone: {androidAccess.phone ? "Granted" : "Missing"}
                </Text>
                <Text style={styles.statusLine}>
                  Call log: {androidAccess.callLog ? "Granted" : "Missing"}
                </Text>
                <Text style={styles.statusLine}>
                  Notifications: {androidAccess.notifications ? "Granted" : "Missing"}
                </Text>
                <Text style={styles.statusLine}>
                  DND: {androidAccess.dnd ? "Granted" : "Missing"}
                </Text>
                <Text style={styles.statusLine}>
                  Sticky live bridge: {androidAccess.liveBridge ? "Running" : "Stopped"}
                </Text>
                <Pressable style={styles.secondaryButton} onPress={requestAndroidFallbackAccess}>
                  <Text style={styles.secondaryButtonText}>Request access</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.infoPanel}>
              <Text style={styles.panelTitle}>Session info</Text>
              <View style={styles.row}>
                <Text style={styles.metaLabel}>Magic text</Text>
                <Text style={styles.metaValue}>{receiverConfig?.magicKeyword ?? "#UNMUTE#"}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.metaLabel}>Last override</Text>
                <Text style={styles.metaValue}>
                  {receiverConfig?.lastTriggerAt
                    ? `${receiverConfig.lastTriggerSource ?? "unknown"} at ${new Date(
                        receiverConfig.lastTriggerAt,
                      ).toLocaleTimeString()}`
                    : "None yet"}
                </Text>
              </View>
            </View>

            <View style={styles.formPanel}>
              <Text style={styles.panelTitle}>Fallback settings</Text>
              <Text style={styles.fieldLabel}>Receiver label</Text>
              <TextInput
                value={receiverLabel}
                onChangeText={setReceiverLabel}
                placeholder="Living room phone"
                placeholderTextColor="#666666"
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>VIP caller numbers</Text>
              <TextInput
                value={vipNumbersText}
                onChangeText={setVipNumbersText}
                placeholder="+1 555 123 4567, +1 555 987 6543"
                placeholderTextColor="#666666"
                style={[styles.input, styles.textArea]}
                multiline
              />
              <Pressable
                style={[styles.primaryButton, busyAction === "save" && styles.buttonDisabled]}
                disabled={busyAction !== null}
                onPress={handleSaveFallbacks}
              >
                <Text style={styles.primaryButtonText}>
                  {busyAction === "save" ? "Saving..." : "Save settings"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.infoPanel}>
              <Text style={styles.statusLine}>
                Latest token: {session.latestCommand?.token ?? "Waiting"}
              </Text>
              <Pressable
                style={[styles.secondaryButton, busyAction === "leave" && styles.buttonDisabled]}
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
  textArea: {
    minHeight: 92,
    textAlignVertical: "top",
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
    gap: 12,
  },
  metaLabel: {
    color: "#666666",
    fontSize: 15,
  },
  metaValue: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  statusLine: {
    color: "#666666",
    fontSize: 15,
    lineHeight: 21,
  },
});
