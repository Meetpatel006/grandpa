import { api } from "@/convex/_generated/api";
import MagicTextModule from "@/modules/magic-text";
import {
  InstallationSnapshot,
  ReceiverNativeConfig,
  TriggerOverrideResult,
} from "@/modules/magic-text";
import { useMutation } from "convex/react";
import { Platform } from "react-native";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type RolePreference = "send" | "receive";

type EmergencyContextValue = {
  ready: boolean;
  deviceId: string | null;
  receiverConfig: ReceiverNativeConfig | null;
  refreshSnapshot: () => Promise<void>;
  saveReceiverConfig: (config: {
    groupId: string;
    inviteCode: string;
    label: string;
    vipNumbers: string[];
  }) => Promise<void>;
  clearReceiverConfig: () => Promise<void>;
  setLastHandledCommandToken: (token: string) => Promise<void>;
  triggerEmergencyOverride: (source: string) => Promise<TriggerOverrideResult>;
  persistRolePreference: (rolePreference: RolePreference) => Promise<void>;
};

const EmergencyContext = createContext<EmergencyContextValue | null>(null);

export function EmergencyProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<InstallationSnapshot | null>(null);
  const [ready, setReady] = useState(false);

  const upsertInstallation = useMutation(api.emergency.upsertInstallation);

  const refreshSnapshot = useCallback(async () => {
    const nextSnapshot = await MagicTextModule.getInstallationSnapshotAsync();
    setSnapshot(nextSnapshot);
    setReady(true);
  }, []);

  useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  useEffect(() => {
    if (!snapshot?.deviceId) {
      return;
    }

    void (async () => {
      let fcmToken: string | undefined;
      if (Platform.OS === "android") {
        try {
          const fcmSnapshot = await MagicTextModule.getFcmTokenAsync();
          fcmToken = fcmSnapshot.token ?? undefined;
        } catch {
          fcmToken = undefined;
        }
      }

      const installation: {
        deviceId: string;
        fcmToken?: string;
        platform: string;
      } = {
        deviceId: snapshot.deviceId,
        platform: Platform.OS,
      };

      if (fcmToken) {
        installation.fcmToken = fcmToken;
      }

      await upsertInstallation(installation);
    })();
  }, [snapshot?.deviceId, upsertInstallation]);

  const persistRolePreference = useCallback(
    async (rolePreference: RolePreference) => {
      if (!snapshot?.deviceId) {
        return;
      }

      await upsertInstallation({
        deviceId: snapshot.deviceId,
        platform: Platform.OS,
        rolePreference,
      });
    },
    [snapshot?.deviceId, upsertInstallation],
  );

  const saveReceiverConfig = useCallback(
    async (config: {
      groupId: string;
      inviteCode: string;
      label: string;
      vipNumbers: string[];
    }) => {
      const nextSnapshot = await MagicTextModule.saveReceiverConfigAsync(
        config.groupId,
        config.inviteCode,
        config.label,
        config.vipNumbers,
      );
      setSnapshot(nextSnapshot);
    },
    [],
  );

  const clearReceiverConfig = useCallback(async () => {
    await MagicTextModule.clearReceiverConfigAsync();
    await refreshSnapshot();
  }, [refreshSnapshot]);

  const setLastHandledCommandToken = useCallback(
    async (token: string) => {
      await MagicTextModule.setLastHandledCommandTokenAsync(token);
      await refreshSnapshot();
    },
    [refreshSnapshot],
  );

  const triggerEmergencyOverride = useCallback(
    async (source: string) => {
      const result = await MagicTextModule.triggerEmergencyOverrideAsync(source);
      await refreshSnapshot();
      return result;
    },
    [refreshSnapshot],
  );

  const value = useMemo<EmergencyContextValue>(
    () => ({
      ready,
      deviceId: snapshot?.deviceId ?? null,
      receiverConfig: snapshot?.receiverConfig ?? null,
      refreshSnapshot,
      saveReceiverConfig,
      clearReceiverConfig,
      setLastHandledCommandToken,
      triggerEmergencyOverride,
      persistRolePreference,
    }),
    [
      clearReceiverConfig,
      persistRolePreference,
      ready,
      refreshSnapshot,
      saveReceiverConfig,
      setLastHandledCommandToken,
      snapshot?.deviceId,
      snapshot?.receiverConfig,
      triggerEmergencyOverride,
    ],
  );

  return (
    <EmergencyContext.Provider value={value}>
      {children}
    </EmergencyContext.Provider>
  );
}

export function useEmergency() {
  const context = useContext(EmergencyContext);

  if (!context) {
    throw new Error("useEmergency must be used inside EmergencyProvider.");
  }

  return context;
}
