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
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { createTask } from "../api/task";
import { PRIMARY, BG, CARD, TEXT_MAIN, TEXT_SUB } from "../constants/theme";

type Props = NativeStackScreenProps<RootStackParamList, "CreateTask">;

interface ParsedItem {
  title: string;
  url: string;
}

/**
 * ヤフオク共有テキスト「商品名\nURL」または「商品名 URL」を分割する。
 * URL が含まれない場合は null を返す。
 */
function parseYahooText(input: string): ParsedItem | null {
  const urlMatch = input.match(/(https?:\/\/\S+)/);
  if (!urlMatch) return null;
  const url = urlMatch[1];
  const title = input.replace(url, "").trim();
  return { title, url };
}

function isValidYahooUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" && u.hostname.endsWith("yahoo.co.jp");
  } catch {
    return false;
  }
}

export function CreateTaskScreen({ navigation, route }: Props) {
  const { roomId, role } = route.params;
  const headerHeight = useHeaderHeight();
  const [rawInput, setRawInput] = useState("");
  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 貼り付けテキストをパースしてプレビュー生成
  const parsed = parseYahooText(rawInput);
  const auctionUrl = parsed ? parsed.url : rawInput;
  const previewTitle = parsed ? parsed.title : null;

  const isValid = isValidYahooUrl(auctionUrl) && /^\d+$/.test(amountText.trim());

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    const result = await createTask(roomId, {
      auctionUrl: auctionUrl.trim(),
      requestedAmount: Number(amountText.trim()),
    });
    setSubmitting(false);
    if (result.error) {
      Alert.alert("エラー", result.error.message);
      return;
    }
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── URLまたはヤフオク共有テキスト ─── */}
          <Text style={styles.label}>URL または ヤフオク共有テキストを貼り付け</Text>
          <TextInput
            style={styles.input}
            placeholder={"商品名\nhttps://page.auctions.yahoo.co.jp/..."}
            placeholderTextColor={TEXT_SUB}
            value={rawInput}
            onChangeText={setRawInput}
            autoCapitalize="none"
            multiline
            numberOfLines={3}
          />

          {/* ─── プレビューカード ─── */}
          {parsed && (
            <View style={styles.previewCard}>
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>ヤフオク</Text>
              </View>
              {previewTitle ? (
                <Text style={styles.previewTitle} numberOfLines={2}>
                  {previewTitle}
                </Text>
              ) : null}
              <Text style={styles.previewUrl} numberOfLines={1}>
                {parsed.url}
              </Text>
            </View>
          )}

          {/* ─── 希望金額 ─── */}
          <Text style={[styles.label, { marginTop: 24 }]}>希望落札金額（円）</Text>
          <View style={styles.amountRow}>
            <TextInput
              style={[styles.input, styles.amountInput]}
              placeholder="例: 5000"
              placeholderTextColor={TEXT_SUB}
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="number-pad"
            />
            <Text style={styles.amountUnit}>円</Text>
          </View>
        </ScrollView>

        {/* ─── ボトムアクション ─── */}
        <View style={styles.bottomArea}>
          <TouchableOpacity
            style={[styles.actionBtn, !isValid && styles.actionBtnDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>商品を追加する</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 8 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_MAIN,
    marginBottom: 8,
  },
  input: {
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: TEXT_MAIN,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  previewCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    minHeight: 90,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
  },
  previewBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E8FAF9",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_MAIN,
    marginBottom: 6,
    lineHeight: 22,
  },
  previewUrl: {
    fontSize: 12,
    color: TEXT_SUB,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "right",
    letterSpacing: 1,
  },
  amountUnit: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_SUB,
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
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
