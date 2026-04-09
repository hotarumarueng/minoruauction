import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,

} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import type { Role } from "../types";
import { createRoom, joinRoom } from "../api/room";
import { saveRoomSession } from "../storage/roomStorage";
import { requestAndGetToken } from "../notifications/tokenRegistration";
import { Ionicons } from "@expo/vector-icons";
import { PRIMARY, SECONDARY, BG, CARD, TEXT_MAIN, TEXT_SUB } from "../constants/theme";

type Props = NativeStackScreenProps<RootStackParamList, "RoomSetup">;

type Tab = "create" | "join";

export function RoomSetupScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>("create");

  // ─── 作成 ────────────────────────────────────────────
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  // ─── 参加 ────────────────────────────────────────────
  const [inviteCode, setInviteCode] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("father");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleCreateRoom() {
    setCreating(true);
    const result = await createRoom();
    setCreating(false);
    if (result.error) {
      Alert.alert("エラー", result.error.message);
      return;
    }
    const roomId = result.data!.roomId;
    setCreatedRoomId(roomId);
    setCopied(false);
  }

  async function handleCopyAndEnter() {
    if (!createdRoomId) return;
    await Clipboard.setStringAsync(createdRoomId);
    setCopied(true);
    await saveRoomSession({ roomId: createdRoomId, role: "father" });
    navigation.replace("MainTabs", { roomId: createdRoomId, role: "father" });
  }

  async function handleJoinRoom() {
    setJoinError(null);
    const code = inviteCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError("招待コードは6文字で入力してください");
      return;
    }
    setJoining(true);
    const deviceToken = (await requestAndGetToken()) ?? "";
    const result = await joinRoom(code, selectedRole, deviceToken);
    setJoining(false);
    if (result.error) {
      setJoinError(
        result.error.code === "roomNotFound"
          ? "このコードは無効です"
          : result.error.message,
      );
      return;
    }
    await saveRoomSession({ roomId: code, role: selectedRole });
    navigation.replace("MainTabs", { roomId: code, role: selectedRole });
  }

  const joinReady = inviteCode.trim().length === 6;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* ─── ヘッダー ─── */}
        <View style={styles.header}>
          <Text style={styles.appName}>minoru</Text>
          <Text style={styles.appSub}>オークション代行アシスタント</Text>
        </View>

        {/* ─── タブ ─── */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "create" && styles.tabBtnActive]}
            onPress={() => setTab("create")}
          >
            <Text style={[styles.tabText, tab === "create" && styles.tabTextActive]}>
              ルームを作る
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "join" && styles.tabBtnActive]}
            onPress={() => setTab("join")}
          >
            <Text style={[styles.tabText, tab === "join" && styles.tabTextActive]}>
              参加する
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── コンテンツ ─── */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {tab === "create" ? (
            <View style={styles.card}>
              {createdRoomId ? (
                <>
                  <Text style={styles.cardLabel}>招待コード</Text>
                  <View style={styles.codeBox}>
                    <Text style={styles.codeText}>{createdRoomId}</Text>
                  </View>
                  <Text style={styles.cardHint}>
                    このコードを相手に共有してください
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.cardLabel}>新しいルームを作成</Text>
                  <Text style={styles.cardHint}>
                    6文字のコードが発行されます。相手に共有してルームに招待しましょう。
                  </Text>
                </>
              )}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>ロールを選択</Text>

              <View style={styles.roleRow}>
                {(["father", "assignee"] as Role[]).map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleBtn,
                      selectedRole === role && styles.roleBtnActive,
                      role === "assignee" && styles.roleBtnAssignee,
                      selectedRole === role && role === "assignee" && styles.roleBtnAssigneeActive,
                    ]}
                    onPress={() => setSelectedRole(role)}
                  >
                    <Ionicons
                      name={role === "father" ? "clipboard-outline" : "cart-outline"}
                      size={28}
                      color={selectedRole === role
                        ? (role === "father" ? PRIMARY : SECONDARY)
                        : TEXT_SUB}
                    />
                    <Text
                      style={[
                        styles.roleLabel,
                        selectedRole === role && styles.roleLabelActive,
                      ]}
                    >
                      {role === "father" ? "依頼する側" : "依頼される側"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.cardLabel, { marginTop: 24 }]}>
                招待コードを入力
              </Text>
              <TextInput
                style={styles.input}
                placeholder="例: ABC123"
                placeholderTextColor={TEXT_SUB}
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="characters"
                maxLength={6}
              />
              {joinError && <Text style={styles.errorText}>{joinError}</Text>}
            </View>
          )}
        </ScrollView>

        {/* ─── ボトムアクションエリア ─── */}
        <View style={styles.bottomArea}>
          {tab === "create" ? (
            createdRoomId ? (
              <TouchableOpacity style={styles.actionBtn} onPress={handleCopyAndEnter}>
                <Text style={styles.actionBtnText}>
                  コードをコピーして入室
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleCreateRoom}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>ルームを作成する</Text>
                )}
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary, !joinReady && styles.actionBtnDisabled]}
              onPress={handleJoinRoom}
              disabled={joining || !joinReady}
            >
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>参加する</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 8,
  },
  appName: {
    fontSize: 36,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 1,
  },
  appSub: {
    fontSize: 14,
    color: TEXT_SUB,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "#EFEFEF",
    borderRadius: 14,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 11,
  },
  tabBtnActive: {
    backgroundColor: CARD,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "500",
    color: TEXT_SUB,
  },
  tabTextActive: {
    color: TEXT_MAIN,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_MAIN,
    marginBottom: 12,
  },
  cardHint: {
    fontSize: 14,
    color: TEXT_SUB,
    lineHeight: 20,
    marginTop: 8,
  },
  codeBox: {
    backgroundColor: BG,
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: "center",
  },
  codeText: {
    fontSize: 44,
    fontWeight: "700",
    letterSpacing: 10,
    color: PRIMARY,
  },
  roleRow: {
    flexDirection: "row",
    gap: 12,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    alignItems: "center",
    backgroundColor: CARD,
  },
  roleBtnActive: {
    borderColor: PRIMARY,
    backgroundColor: "#F0FAFA",
  },
  roleBtnAssignee: {
    borderColor: "#E0E0E0",
  },
  roleBtnAssigneeActive: {
    borderColor: SECONDARY,
    backgroundColor: "#FFF5F5",
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_SUB,
    textAlign: "center",
  },
  roleLabelActive: {
    color: TEXT_MAIN,
  },
  input: {
    backgroundColor: BG,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 6,
    color: TEXT_MAIN,
    textAlign: "center",
  },
  errorText: {
    color: SECONDARY,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  bottomArea: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 8 : 16,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },
  actionBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  actionBtnSecondary: {
    backgroundColor: SECONDARY,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
