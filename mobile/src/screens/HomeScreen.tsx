import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,

  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { TabParamList } from "../navigation";
import { Ionicons } from "@expo/vector-icons";
import { clearRoomSession } from "../storage/roomStorage";
import { PRIMARY, SECONDARY, BG, CARD, TEXT_MAIN, TEXT_SUB } from "../constants/theme";

type Props = BottomTabScreenProps<TabParamList, "Home">;

export function HomeScreen({ route, navigation }: Props) {
  const { roomId, role } = route.params;

  async function handleDisconnect() {
    Alert.alert("退出", "このルームから退出しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "退出する",
        style: "destructive",
        onPress: async () => {
          await clearRoomSession();
          // ルートスタックの RoomSetup に戻る
          (navigation as any).getParent()?.replace("RoomSetup");
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.appName}>minoru</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>ルームID</Text>
          <Text style={styles.codeText}>{roomId}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>あなたのロール</Text>
          <View style={styles.roleBadge}>
            <Ionicons
              name={role === "father" ? "clipboard-outline" : "cart-outline"}
              size={20}
              color={role === "father" ? PRIMARY : SECONDARY}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.roleText}>
              {role === "father" ? "依頼する側" : "依頼される側"}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
          <Text style={styles.disconnectText}>ルームを退出する</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1, padding: 24, gap: 16 },
  appName: {
    fontSize: 32,
    fontWeight: "700",
    color: PRIMARY,
    marginBottom: 8,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_SUB,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  codeText: {
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: 8,
    color: PRIMARY,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F0FAFA",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  roleText: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_MAIN,
  },
  disconnectBtn: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FF6B6B",
  },
  disconnectText: {
    color: "#FF6B6B",
    fontSize: 16,
    fontWeight: "600",
  },
});
