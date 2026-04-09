import { api } from "@/convex/_generated/api";
import { useEmergency } from "@/providers/emergency-provider";
import { useMutation, useQuery } from "convex/react";
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

export default function ReceiverScreen() {
  const {
    ready,
    deviceId,
    receiverConfig,
    saveReceiverConfig,
    clearReceiverConfig,
    setLastHandledCommandToken,
    triggerEmergencyOverride,
    persistRolePreference,
  } = useEmergency();

  const [inviteCode, setInviteCode] = useState(receiverConfig?.inviteCode ?? "");
  const [receiverLabel, setReceiverLabel] = useState(receiverConfig?.label ?? "Living room phone");
  const [vipNumbersText, setVipNumbersText] = useState(
    receiverConfig?.vipNumbers.join(", ") ?? "",
  );
  const [busyAction, setBusyAction] = useState<"join" | "save" | "leave" | null>(null);

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

      Alert.alert(
        "Receiver connected",
        "Realtime Convex sync is active. SMS and VIP call fallbacks are stored locally.",
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Receiver mode</Text>
        <Text style={styles.title}>Keep this device ready to break out of silent mode</Text>
        <Text style={styles.subtitle}>
          Convex is the primary channel. If the network path fails, `#UNMUTE#`
          SMS and configured VIP calls still trigger the same native override.
        </Text>
      </View>

      {!session ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Join a sender group</Text>
          <Text style={styles.fieldLabel}>Invite code</Text>
          <TextInput
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            placeholder="AB12CD"
            placeholderTextColor="#6E7A80"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Receiver label</Text>
          <TextInput
            value={receiverLabel}
            onChangeText={setReceiverLabel}
            placeholder="Living room phone"
            placeholderTextColor="#6E7A80"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>VIP caller numbers</Text>
          <TextInput
            value={vipNumbersText}
            onChangeText={setVipNumbersText}
            placeholder="+1 555 123 4567, +1 555 987 6543"
            placeholderTextColor="#6E7A80"
            style={[styles.input, styles.textArea]}
            multiline
          />

          <Pressable
            style={[styles.primaryButton, busyAction === "join" && styles.buttonDisabled]}
            disabled={busyAction !== null}
            onPress={handleJoin}
          >
            <Text style={styles.primaryButtonText}>
              {busyAction === "join" ? "Joining..." : "Join group"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Active receiver session</Text>
            <View style={styles.row}>
              <Text style={styles.metaLabel}>Sender</Text>
              <Text style={styles.metaValue}>{session.adminLabel}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.metaLabel}>Invite code</Text>
              <Text style={styles.metaValue}>{session.inviteCode}</Text>
            </View>
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

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fallback settings</Text>
            <Text style={styles.fieldLabel}>Receiver label</Text>
            <TextInput
              value={receiverLabel}
              onChangeText={setReceiverLabel}
              placeholder="Living room phone"
              placeholderTextColor="#6E7A80"
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>VIP caller numbers</Text>
            <TextInput
              value={vipNumbersText}
              onChangeText={setVipNumbersText}
              placeholder="+1 555 123 4567, +1 555 987 6543"
              placeholderTextColor="#6E7A80"
              style={[styles.input, styles.textArea]}
              multiline
            />
            <Pressable
              style={[styles.primaryButton, busyAction === "save" && styles.buttonDisabled]}
              disabled={busyAction !== null}
              onPress={handleSaveFallbacks}
            >
              <Text style={styles.primaryButtonText}>
                {busyAction === "save" ? "Saving..." : "Save fallback settings"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Command state</Text>
            <Text style={styles.statusLine}>
              Latest Convex token: {session.latestCommand?.token ?? "Waiting"}
            </Text>
            <Text style={styles.statusLine}>
              Last handled token: {receiverConfig?.lastHandledCommandToken ?? "None"}
            </Text>
            <Pressable
              style={[styles.secondaryButton, busyAction === "leave" && styles.buttonDisabled]}
              disabled={busyAction !== null}
              onPress={handleLeave}
            >
              <Text style={styles.secondaryButtonText}>
                {busyAction === "leave" ? "Leaving..." : "Disconnect receiver"}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF1EB",
  },
  loadingText: {
    color: "#1F2B30",
    fontSize: 16,
  },
  container: {
    padding: 20,
    gap: 18,
    backgroundColor: "#EAF1EB",
  },
  hero: {
    backgroundColor: "#1E5C4D",
    borderRadius: 26,
    padding: 22,
    gap: 10,
  },
  kicker: {
    color: "#CDEADD",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "800",
    lineHeight: 35,
  },
  subtitle: {
    color: "#E3FFF5",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },
  cardTitle: {
    color: "#203036",
    fontSize: 20,
    fontWeight: "700",
  },
  fieldLabel: {
    color: "#536269",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D0D9D2",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#F6FAF7",
    color: "#1F2B30",
    fontSize: 17,
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#1E5C4D",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#263A34",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButtonText: {
    color: "#FFFFFF",
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
    color: "#5E6F74",
    fontSize: 15,
  },
  metaValue: {
    color: "#182429",
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  statusLine: {
    color: "#475A5F",
    fontSize: 15,
    lineHeight: 21,
  },
});
