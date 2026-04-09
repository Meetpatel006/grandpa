import { Link } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Emergency audio bridge</Text>
        <Text style={styles.title}>Choose how this device participates</Text>
        <Text style={styles.subtitle}>
          Senders manage a live group. Receivers stay connected and can be forced
          out of silent mode through Convex, SMS, or VIP calls.
        </Text>
      </View>

      <View style={styles.cardStack}>
        <Link href="/sender" asChild>
          <TouchableOpacity style={[styles.card, styles.senderCard]}>
            <Text style={styles.cardKicker}>Admin role</Text>
            <Text style={styles.cardTitle}>Send</Text>
            <Text style={styles.cardBody}>
              Create a group, watch receivers connect in realtime, and trigger
              unmute for one receiver or everyone.
            </Text>
          </TouchableOpacity>
        </Link>

        <Link href="/receiver" asChild>
          <TouchableOpacity style={[styles.card, styles.receiverCard]}>
            <Text style={styles.cardKicker}>Listener role</Text>
            <Text style={styles.cardTitle}>Receive</Text>
            <Text style={styles.cardBody}>
              Join a group, keep fallback settings on-device, and respond to live
              or offline emergency overrides.
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3EFE5",
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "space-between",
  },
  hero: {
    gap: 14,
    marginTop: 48,
  },
  eyebrow: {
    color: "#9B4D29",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#1E2A2F",
    fontSize: 38,
    fontWeight: "800",
    lineHeight: 44,
  },
  subtitle: {
    color: "#4A5A63",
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 420,
  },
  cardStack: {
    gap: 16,
    marginBottom: 36,
  },
  card: {
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 26,
    gap: 8,
  },
  senderCard: {
    backgroundColor: "#B44C27",
  },
  receiverCard: {
    backgroundColor: "#244F46",
  },
  cardKicker: {
    color: "#F7E8DD",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
  },
  cardBody: {
    color: "#F5F5F5",
    fontSize: 16,
    lineHeight: 23,
  },
});
