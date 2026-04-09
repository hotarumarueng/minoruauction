import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import type { Task } from "../types";
import { PRIMARY } from "../constants/theme";
import { getTasks, updateTaskStatus, updateTaskAmount, deleteTask } from "../api/task";

type Props = NativeStackScreenProps<RootStackParamList, "TaskDetail">;

/** ヤフオクの https URL のみ許可する（任意スキームのディープリンク実行を防ぐ） */
function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith("yahoo.co.jp");
  } catch {
    return false;
  }
}

export function TaskDetailScreen({ route, navigation }: Props) {
  const { roomId, taskId, role } = route.params;
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Alert.prompt は iOS 専用のため、インライン TextInput で金額変更を実現する
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountText, setAmountText] = useState("");

  useEffect(() => {
    getTasks(roomId).then((result) => {
      if (result.data) {
        const found = result.data.find((t) => t.taskId === taskId) ?? null;
        setTask(found);
      }
      setLoading(false);
    });
  }, [roomId, taskId]);

  async function handleUpdateStatus(status: Task["status"]) {
    if (!task) return;
    setUpdating(true);
    const result = await updateTaskStatus(roomId, taskId, { status });
    setUpdating(false);
    if (result.error) {
      Alert.alert("エラー", result.error.message);
      return;
    }
    setTask(result.data!);
  }

  async function handleSubmitAmount() {
    if (!task) return;
    const n = Number(amountText.trim());
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert("エラー", "正しい金額を入力してください");
      return;
    }
    setUpdating(true);
    const result = await updateTaskAmount(roomId, taskId, { requestedAmount: n });
    setUpdating(false);
    if (result.error) {
      Alert.alert("エラー", result.error.message);
      return;
    }
    setTask(result.data!);
    setEditingAmount(false);
  }

  function handleOpenUrl() {
    if (!isAllowedUrl(task!.auctionUrl)) {
      Alert.alert("エラー", "無効なURLです");
      return;
    }
    Linking.openURL(task!.auctionUrl);
  }

  async function handleShare() {
    if (!task) return;
    await Share.share({
      message: `【希望金額 ¥${task.requestedAmount.toLocaleString()}】\n${task.auctionUrl}`,
      url: task.auctionUrl, // iOS のみ有効（メッセージとは別にリンクを渡す）
    });
  }

  async function handleDelete() {
    Alert.alert(
      "削除確認",
      "この商品を削除しますか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: async () => {
            const result = await deleteTask(roomId, taskId);
            if (result.error) {
              Alert.alert("エラー", result.error.message);
              return;
            }
            navigation.goBack();
          },
        },
      ]
    );
  }

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color={PRIMARY} />;
  }
  if (!task) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>商品が見つかりません</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ─── ヤフオクURL ＋ 共有 ─── */}
      <View style={styles.linkRow}>
        <TouchableOpacity onPress={handleOpenUrl}>
          <Text style={styles.link}>ヤフオクで見る →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonText}>共有</Text>
        </TouchableOpacity>
      </View>

      {/* ─── 現在のステータス ─── */}
      <Text style={styles.sectionLabel}>ステータス</Text>
      <Text style={styles.statusText}>{task.status}</Text>

      {/* ─── assignee 用アクションボタン ─── */}
      {role === "assignee" && (
        <View style={styles.actionArea}>
          {task.status === "未入札" && (
            <TouchableOpacity
              style={styles.bidButton}
              onPress={() => handleUpdateStatus("入札済み")}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.bidButtonLabel}>希望金額</Text>
                  <Text style={styles.bidButtonAmount}>
                    ¥{task.requestedAmount.toLocaleString()}
                  </Text>
                  <Text style={styles.bidButtonHint}>タップして入札済みに更新</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {task.status === "入札済み" && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rebidButton]}
                onPress={() => handleUpdateStatus("要再入札")}
                disabled={updating}
              >
                <Text style={styles.actionButtonText}>要再入札</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.wonButton]}
                onPress={() => handleUpdateStatus("落札")}
                disabled={updating}
              >
                <Text style={styles.actionButtonText}>落札</Text>
              </TouchableOpacity>
            </View>
          )}

          {task.status === "要再入札" && (
            <Text style={styles.waitText}>父の金額更新待ち…</Text>
          )}

          {task.status === "落札" && (
            <Text style={styles.wonText}>落札済み</Text>
          )}
        </View>
      )}

      {/* ─── father 用: 金額更新（未入札 or 要再入札 時のみ） ─── */}
      {role === "father" && (task.status === "未入札" || task.status === "要再入札") && (
        <View style={styles.actionArea}>
          <Text style={styles.sectionLabel}>希望金額</Text>
          {editingAmount ? (
            <View style={styles.amountEditRow}>
              <TextInput
                style={styles.amountInput}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="number-pad"
                autoFocus
              />
              <TouchableOpacity
                style={styles.amountConfirmButton}
                onPress={handleSubmitAmount}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.amountConfirmText}>確定</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.amountCancelButton}
                onPress={() => setEditingAmount(false)}
                disabled={updating}
              >
                <Text style={styles.amountCancelText}>キャンセル</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.currentAmount}>¥{task.requestedAmount.toLocaleString()}</Text>
              <TouchableOpacity
                style={styles.amountButton}
                onPress={() => {
                  setAmountText(String(task.requestedAmount));
                  setEditingAmount(true);
                }}
                disabled={updating}
              >
                <Text style={styles.amountButtonText}>金額を変更する</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* ─── ステータス履歴 ─── */}
      <Text style={styles.sectionLabel}>更新履歴</Text>
      {task.statusHistory.length === 0 ? (
        <Text style={styles.emptyHistory}>履歴なし</Text>
      ) : (
        [...task.statusHistory].reverse().map((entry, i) => (
          <View key={i} style={styles.historyRow}>
            <Text style={styles.historyStatus}>{entry.status}</Text>
            <Text style={styles.historyTime}>
              {new Date(entry.timestamp).toLocaleString("ja-JP")}
            </Text>
          </View>
        ))
      )}

      {/* ─── assignee 用: 削除ボタン ─── */}
      {role === "assignee" && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={updating}
        >
          <Text style={styles.deleteButtonText}>この商品を削除する</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 16,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  link: {
    color: PRIMARY,
    fontSize: 15,
    textDecorationLine: "underline",
  },
  shareButton: {
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
  },
  actionArea: {
    marginTop: 24,
  },
  bidButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: "center",
  },
  bidButtonLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
  },
  bidButtonAmount: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    marginVertical: 4,
  },
  bidButtonHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  rebidButton: {
    backgroundColor: "#E65100",
  },
  wonButton: {
    backgroundColor: "#388E3C",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  waitText: {
    color: "#888",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
  },
  wonText: {
    color: "#388E3C",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  currentAmount: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111",
  },
  amountEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
  },
  amountConfirmButton: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  amountConfirmText: {
    color: "#fff",
    fontWeight: "600",
  },
  amountCancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  amountCancelText: {
    color: "#888",
    fontSize: 14,
  },
  amountButton: {
    marginTop: 12,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  amountButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyHistory: {
    color: "#bbb",
    fontSize: 14,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  historyStatus: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  historyTime: {
    fontSize: 13,
    color: "#888",
  },
  deleteButton: {
    marginTop: 32,
    marginBottom: 16,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FF6B6B",
  },
  deleteButtonText: {
    color: "#FF6B6B",
    fontSize: 15,
    fontWeight: "600",
  },
});
