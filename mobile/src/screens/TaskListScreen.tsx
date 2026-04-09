import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,

  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import type { Task, TaskStatus } from "../types";
import { getTasks } from "../api/task";
import { PRIMARY, BG, CARD, TEXT_MAIN, TEXT_SUB } from "../constants/theme";

type Props = {
  route: { params: { roomId: string; role: "father" | "assignee" } };
};

const POLL_INTERVAL_MS = 30_000;

const STATUS_COLOR: Record<TaskStatus, string> = {
  未入札: "#9E9E9E",
  入札済み: "#1976D2",
  要再入札: "#E65100",
  落札: "#388E3C",
};

const STATUS_BG: Record<TaskStatus, string> = {
  未入札: "#F5F5F5",
  入札済み: "#E3F2FD",
  要再入札: "#FFF3E0",
  落札: "#E8F5E9",
};

export function TaskListScreen({ route }: Props) {
  const { roomId, role } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const prevCountRef = useRef<number>(-1);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function showBanner(msg: string) {
    setBannerMsg(msg);
    Animated.sequence([
      Animated.timing(bannerAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(bannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setBannerMsg(null));
  }

  const fetchTasks = useCallback(async (showFeedback = false) => {
    const result = await getTasks(roomId);
    setLoading(false);
    setRefreshing(false);
    if (result.error) {
      setFetchError(result.error.message);
      return;
    }
    setFetchError(null);
    const newTasks = result.data!;
    if (showFeedback && prevCountRef.current >= 0 && newTasks.length > prevCountRef.current) {
      showBanner("商品を追加しました ✓");
    }
    prevCountRef.current = newTasks.length;
    setTasks(newTasks);
  }, [roomId]);

  // 画面にフォーカスが当たるたびにリロード（CreateTask から戻ったときも含む）
  useFocusEffect(
    useCallback(() => {
      fetchTasks(true);
      pollRef.current = setInterval(() => fetchTasks(false), POLL_INTERVAL_MS);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [fetchTasks]),
  );

  function handleManualReload() {
    setRefreshing(true);
    fetchTasks(false).then(() => showBanner("更新しました"));
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* ─── フィードバックバナー ─── */}
      {bannerMsg && (
        <Animated.View style={[styles.banner, { opacity: bannerAnim }]}>
          <Text style={styles.bannerText}>{bannerMsg}</Text>
        </Animated.View>
      )}

      {/* ─── ヘッダー ─── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>商品一覧</Text>
        <TouchableOpacity style={styles.reloadBtn} onPress={handleManualReload} disabled={refreshing}>
          {refreshing
            ? <ActivityIndicator size="small" color={PRIMARY} />
            : <Text style={styles.reloadIcon}>↻</Text>}
        </TouchableOpacity>
      </View>

      {/* ─── リスト ─── */}
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={PRIMARY} />
      ) : fetchError ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{fetchError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleManualReload}>
            <Text style={styles.retryBtnText}>再試行</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.taskId}
          contentContainerStyle={[
            styles.listContent,
            tasks.length === 0 && styles.centerBox,
          ]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate("TaskDetail", { roomId, taskId: item.taskId, role })
              }
            >
              <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[item.status] }]}>
                <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
                  {item.status}
                </Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.amount}>
                  ¥{item.requestedAmount.toLocaleString()}
                </Text>
                <Text style={styles.url} numberOfLines={1}>
                  {item.auctionUrl}
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🛍️</Text>
              <Text style={styles.emptyText}>商品がありません</Text>
              <Text style={styles.emptyHint}>
                ＋ボタンからヤフオクの商品URLを追加しましょう
              </Text>
            </View>
          }
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  banner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 12,
    left: 20,
    right: 20,
    zIndex: 100,
    backgroundColor: "#2D3436",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  bannerText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: TEXT_MAIN },
  reloadBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0FAFA",
    justifyContent: "center",
    alignItems: "center",
  },
  reloadIcon: { fontSize: 20, color: PRIMARY },
  loader: { flex: 1 },
  listContent: { padding: 16, gap: 10 },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statusBadge: {
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: 12,
    minWidth: 72,
    alignItems: "center",
  },
  statusText: { fontSize: 12, fontWeight: "700" },
  cardBody: { flex: 1 },
  amount: { fontSize: 18, fontWeight: "700", color: TEXT_MAIN, marginBottom: 2 },
  url: { fontSize: 12, color: TEXT_SUB },
  arrow: { fontSize: 22, color: "#CCCCCC", marginLeft: 8 },
  centerBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyBox: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: TEXT_MAIN, fontSize: 17, fontWeight: "600", marginBottom: 8 },
  emptyHint: { color: TEXT_SUB, fontSize: 13, textAlign: "center", paddingHorizontal: 32 },
  errorText: { color: "#D32F2F", fontSize: 15, textAlign: "center", paddingHorizontal: 24, marginBottom: 16 },
  retryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: { color: "#fff", fontWeight: "600" },
});
