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

const PRESENCE_TTL_MS = 30_000;

export default function SenderScreen() {
  const { ready, deviceId, persistRolePreference } = useEmergency();

  const [adminLabel, setAdminLabel] = useState("Primary sender");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState<"create" | "all" | "specific" | null>(null);

  const dashboard = useQuery(
    api.emergency.senderDashboard,
    ready && deviceId ? { adminDeviceId: deviceId } : "skip",
  );

  const createGroup = useMutation(api.emergency.createGroup);
  const sendUnmute = useMutation(api.emergency.sendUnmute);
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
      current.filter((deviceIdToKeep) =>
        dashboard.receivers.some(({ deviceId: receiverId }) => receiverId === deviceIdToKeep),
      ),
    );
  }, [dashboard?.receivers]);

  useEffect(() => {
    if (!dashboard?.groupId || !deviceId) {
      return;
    }

    const sendHeartbeat = (connectionState: "connecting" | "connected" | "background") => {
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
    return (dashboard?.receivers ?? []).map((receiver) => ({
      ...receiver,
      online:
        receiver.lastHeartbeatAt !== null &&
        Date.now() - receiver.lastHeartbeatAt <= PRESENCE_TTL_MS,
    }));
  }, [dashboard?.receivers]);

  const handleCreateGroup = async () => {
    if (!deviceId) {
      return;
    }

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
    if (!dashboard?.groupId || !deviceId) {
      return;
    }

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
          : "The selected receivers were targeted.",
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
        : [...current, receiverId],
    );
  };

  if (!ready) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading sender device profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.kicker}>Sender console</Text>
        <Text style={styles.title}>Run the emergency group from this device</Text>
        <Text style={styles.subtitle}>
          Convex handles the live session. SMS and VIP calls remain available as
          offline fallbacks on receiver devices.
        </Text>
      </View>

      {!dashboard ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Create or resume a group</Text>
          <Text style={styles.fieldLabel}>Sender label</Text>
          <TextInput
            value={adminLabel}
            onChangeText={setAdminLabel}
            placeholder="Primary sender"
            placeholderTextColor="#7D878C"
            style={styles.input}
          />
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
      ) : (
        <>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Current session</Text>
            <View style={styles.row}>
              <Text style={styles.metaLabel}>Invite code</Text>
              <Text style={styles.metaValue}>{dashboard.inviteCode}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.metaLabel}>Receivers</Text>
              <Text style={styles.metaValue}>{receivers.length}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.metaLabel}>Last broadcast</Text>
              <Text style={styles.metaValue}>
                {dashboard.lastCommandAt
                  ? new Date(dashboard.lastCommandAt).toLocaleTimeString()
                  : "None yet"}
              </Text>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Connected receivers</Text>
            {receivers.length === 0 ? (
              <Text style={styles.emptyState}>
                No receivers have joined yet. Share the invite code to connect one.
              </Text>
            ) : (
              receivers.map((receiver) => (
                <Pressable
                  key={receiver.deviceId}
                  onPress={() => toggleReceiver(receiver.deviceId)}
                  style={[
                    styles.receiverRow,
                    selectedIds.includes(receiver.deviceId) && styles.receiverRowSelected,
                  ]}
                >
                  <View style={styles.receiverCopy}>
                    <Text style={styles.receiverLabel}>{receiver.label}</Text>
                    <Text style={styles.receiverMeta}>
                      {receiver.online ? "Online" : "Stale"} · {receiver.connectionState}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.selectionDot,
                      selectedIds.includes(receiver.deviceId) && styles.selectionDotActive,
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
              style={[styles.secondaryButton, busyAction === "specific" && styles.buttonDisabled]}
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
    backgroundColor: "#F5F0E7",
  },
  loadingText: {
    color: "#213036",
    fontSize: 16,
  },
  container: {
    padding: 20,
    gap: 18,
    backgroundColor: "#F5F0E7",
  },
  headerCard: {
    backgroundColor: "#A6411A",
    borderRadius: 26,
    padding: 22,
    gap: 10,
  },
  kicker: {
    color: "#FFDCC7",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
  },
  subtitle: {
    color: "#FFEDE3",
    fontSize: 15,
    lineHeight: 22,
  },
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },
  actionsPanel: {
    gap: 12,
    marginBottom: 30,
  },
  panelTitle: {
    color: "#223037",
    fontSize: 20,
    fontWeight: "700",
  },
  fieldLabel: {
    color: "#55656C",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D8D0C6",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: "#1F2A30",
    backgroundColor: "#FAF7F2",
  },
  primaryButton: {
    backgroundColor: "#A6411A",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#23343B",
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
    alignItems: "center",
  },
  metaLabel: {
    color: "#5F6D73",
    fontSize: 15,
  },
  metaValue: {
    color: "#152126",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyState: {
    color: "#5F6D73",
    fontSize: 15,
    lineHeight: 21,
  },
  receiverRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5DDD3",
    padding: 14,
  },
  receiverRowSelected: {
    borderColor: "#A6411A",
    backgroundColor: "#FFF3EE",
  },
  receiverCopy: {
    gap: 4,
    flex: 1,
    paddingRight: 12,
  },
  receiverLabel: {
    color: "#18242A",
    fontSize: 17,
    fontWeight: "700",
  },
  receiverMeta: {
    color: "#607076",
    fontSize: 14,
  },
  selectionDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#BAC4C8",
  },
  selectionDotActive: {
    borderColor: "#A6411A",
    backgroundColor: "#A6411A",
  },
});
