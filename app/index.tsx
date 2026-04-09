import { Link } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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

      <View style={styles.buttonStack}>
        <Link href="/sender" asChild>
          <TouchableOpacity activeOpacity={0.7} style={styles.button}>
            <View style={styles.buttonContent}>
              <View style={styles.buttonLeft}>
                <Text style={styles.buttonKicker}>Admin role</Text>
                <Text style={styles.buttonTitle}>Send</Text>
              </View>
              <Ionicons name="send" size={28} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </Link>

        <Link href="/receiver" asChild>
          <TouchableOpacity activeOpacity={0.7} style={styles.button}>
            <View style={styles.buttonContent}>
              <View style={styles.buttonLeft}>
                <Text style={styles.buttonKicker}>Listener role</Text>
                <Text style={styles.buttonTitle}>Receive</Text>
              </View>
              <Ionicons name="ear" size={28} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  hero: {
    gap: 14,
    alignItems: "center",
  },
  eyebrow: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#000000",
    fontSize: 38,
    fontWeight: "800",
    lineHeight: 44,
  },
  subtitle: {
    color: "#2F2F2F",
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 420,
  },
  buttonStack: {
    gap: 16,
    marginTop: 40,
    width: "100%",
    alignItems: "center",
  },
  button: {
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: "#000000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  buttonLeft: {
    gap: 4,
  },
  buttonKicker: {
    color: "#CCCCCC",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  buttonTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
  },
  });
