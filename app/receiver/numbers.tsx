import * as Contacts from "expo-contacts";
import { api } from "@/convex/_generated/api";
import { Link } from "expo-router";
import { useEmergency } from "@/providers/emergency-provider";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ContactNumber {
  countryCode: string;
  phoneNumber: string;
}

export default function ReceiverNumbersScreen() {
  const {
    ready,
    deviceId,
    receiverConfig,
    saveReceiverConfig,
    persistRolePreference,
  } = useEmergency();

  const [receiverLabel, setReceiverLabel] = useState(
    receiverConfig?.label ?? "Living room phone"
  );
  const [inviteCode, setInviteCode] = useState(receiverConfig?.inviteCode ?? "");
  const [contactNumbers, setContactNumbers] = useState<ContactNumber[]>([
    { countryCode: "+1", phoneNumber: "" },
  ]);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [busyAction, setBusyAction] = useState<"join" | "permission" | null>(null);

  const joinGroup = useMutation(api.emergency.joinGroup);

  useEffect(() => {
    void persistRolePreference("receive");
  }, [persistRolePreference]);

  const requestContactsPermission = async () => {
    setBusyAction("permission");
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Allow access to contacts to search for emergency numbers."
        );
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
      setContacts(data);
      setShowContactPicker(true);
    } catch (error) {
      Alert.alert("Error", "Could not load contacts.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleContactSelect = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/[^\d]/g, "");
    let countryCode = "+1";

    if (phoneNumber.startsWith("+1") && cleaned.length === 11) {
      countryCode = "+1";
    } else if (phoneNumber.startsWith("+44") && cleaned.length === 12) {
      countryCode = "+44";
    } else if (phoneNumber.startsWith("+91") && cleaned.length === 12) {
      countryCode = "+91";
    }

    setContactNumbers([...contactNumbers, { countryCode, phoneNumber: cleaned }]);
    setShowContactPicker(false);
    setSearchQuery("");
  };

  const updateContactNumber = (index: number, field: keyof ContactNumber, value: string) => {
    const updated = [...contactNumbers];
    updated[index] = { ...updated[index], [field]: value };
    setContactNumbers(updated);
  };

  const addContactField = () => {
    setContactNumbers([...contactNumbers, { countryCode: "+1", phoneNumber: "" }]);
  };

  const removeContactField = (index: number) => {
    if (contactNumbers.length > 1) {
      setContactNumbers(contactNumbers.filter((_, i) => i !== index));
    }
  };

  const getFullNumbers = (): string[] => {
    return contactNumbers
      .map((c) => c.countryCode + c.phoneNumber)
      .filter((n) => n !== "+" && n.length > 1);
  };

  const handleJoin = async () => {
    if (!deviceId || !inviteCode.trim() || !receiverLabel.trim()) {
      Alert.alert("Missing information", "Add an invite code and receiver label.");
      return;
    }

    const normalizedInviteCode = inviteCode.trim().toUpperCase();
    if (normalizedInviteCode.length !== 6) {
      Alert.alert("Invalid code", "Invite codes are 6 characters.");
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
        vipNumbers: getFullNumbers(),
      });

      Alert.alert("Connected", "Receiver joined successfully.");
    } catch (error) {
      Alert.alert("Join failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusyAction(null);
    }
  };

  const filteredContacts = searchQuery
    ? contacts.filter(
        (c) =>
          c.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.phoneNumbers?.some((p: Contacts.PhoneNumber) =>
            p.number?.replace(/[^\d]/g, "").includes(searchQuery)
          )
      )
    : contacts;

  if (!ready) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroSection}>
          <Text style={styles.eyebrow}>VIP caller numbers</Text>
          <Text style={styles.heroTitle}>Add emergency contacts</Text>
          <Text style={styles.heroSubtitle}>
            These numbers can trigger unmute via SMS or calls when offline.
          </Text>
        </View>

        {showContactPicker ? (
          <View style={styles.formPanel}>
            <Text style={styles.fieldLabel}>Search contacts</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name or number"
              placeholderTextColor="#666666"
              style={styles.input}
            />
            <Pressable style={styles.backButton} onPress={() => setShowContactPicker(false)}>
              <Text style={styles.backButtonText}>Cancel</Text>
            </Pressable>

            <View style={styles.contactsList}>
              {filteredContacts.slice(0, 10).map((contact, index) => (
                <Pressable
                  key={contact.id || index}
                  style={styles.contactRow}
                  onPress={() => {
                    const phone = contact.phoneNumbers?.[0]?.number;
                    if (phone) handleContactSelect(phone);
                  }}
                >
                  <Text style={styles.contactName}>
                    {contact.firstName} {contact.lastName}
                  </Text>
                  <Text style={styles.contactNumber}>
                    {contact.phoneNumbers?.[0]?.number}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.formPanel}>
            <Pressable
              style={[styles.secondaryButton, busyAction === "permission" && styles.buttonDisabled]}
              disabled={busyAction !== null}
              onPress={requestContactsPermission}
            >
              <Ionicons name="person-add" size={20} color="#000000" />
              <Text style={styles.secondaryButtonText}>Search contacts</Text>
            </Pressable>

            <Text style={styles.fieldLabel}>VIP caller numbers</Text>
            {contactNumbers.map((contact, index) => (
              <View key={index} style={styles.phoneRow}>
                <TextInput
                  value={contact.countryCode}
                  onChangeText={(value) => updateContactNumber(index, "countryCode", value)}
                  placeholder="+1"
                  placeholderTextColor="#666666"
                  style={[styles.input, styles.countryInput]}
                  keyboardType="phone-pad"
                />
                <TextInput
                  value={contact.phoneNumber}
                  onChangeText={(value) => updateContactNumber(index, "phoneNumber", value)}
                  placeholder="555 123 4567"
                  placeholderTextColor="#666666"
                  style={[styles.input, styles.phoneInput]}
                  keyboardType="phone-pad"
                />
                {contactNumbers.length > 1 && (
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => removeContactField(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#000000" />
                  </Pressable>
                )}
              </View>
            ))}

            <Pressable style={styles.addButton} onPress={addContactField}>
              <Ionicons name="add-circle-outline" size={20} color="#000000" />
              <Text style={styles.addButtonText}>Add another number</Text>
            </Pressable>

            <Pressable
              style={[styles.primaryButton, busyAction === "join" && styles.buttonDisabled]}
              disabled={busyAction !== null}
              onPress={handleJoin}
            >
              <Text style={styles.primaryButtonText}>
                {busyAction === "join" ? "Joining..." : "Join group"}
              </Text>
            </Pressable>

            <Link href="/receiver" asChild>
              <Pressable style={styles.backButton}>
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            </Link>
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
  contactsList: {
    maxHeight: 300,
    borderWidth: 1,
    borderColor: "#000000",
    borderRadius: 16,
  },
  contactRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  contactName: {
    color: "#000000",
    fontSize: 17,
    fontWeight: "600",
  },
  contactNumber: {
    color: "#666666",
    fontSize: 14,
    marginTop: 4,
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
  phoneRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  countryInput: {
    width: 70,
  },
  phoneInput: {
    flex: 1,
  },
  removeButton: {
    padding: 4,
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
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
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
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  addButtonText: {
    color: "#000000",
    fontSize: 17,
    fontWeight: "600",
  },
  backButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  backButtonText: {
    color: "#000000",
    fontSize: 17,
    fontWeight: "600",
  },
});