import React, { useRef, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Platform,
  Animated,
  Dimensions,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const PRIMARY = "#4ECDC4";
const SECONDARY = "#FF6B6B";
const INACTIVE = "#B2BEC3";
const BAR_BG = "#FFFFFF";
const APP_BG = "#F8F9FA"; // アプリ背景色 ── インジケーターの色と一致させる

const { width: SCREEN_W } = Dimensions.get("window");
const BAR_MARGIN = 24;
const BAR_W = SCREEN_W - BAR_MARGIN * 2;
const NUM_SLOTS = 3; // Home + Tasks + Plus
const SLOT_W = BAR_W / NUM_SLOTS;

const BAR_H = 64;
const CIRCLE_BG = 58; // APP_BG 色の外円
const INNER_C = 48;   // 白 + PRIMARY ボーダーの内円

const TAB_ICONS: Record<string, string> = {
  Home: "⌂",
  Tasks: "☰",
};

export function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const rootNav = navigation.getParent() as any;
  const firstRoute = state.routes[0];
  const roomId: string = (firstRoute?.params as any)?.roomId ?? "";
  const role: string = (firstRoute?.params as any)?.role ?? "father";

  // インジケーターの横移動アニメーション
  const indicatorX = useRef(new Animated.Value(state.index * SLOT_W)).current;

  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: state.index * SLOT_W,
      useNativeDriver: true,
      damping: 16,
      stiffness: 160,
      mass: 1,
    }).start();
  }, [state.index]);

  function handlePlusPress() {
    rootNav?.navigate("CreateTask", { roomId, role });
  }

  const activeIcon = TAB_ICONS[state.routes[state.index]?.name ?? ""] ?? "○";

  return (
    <View style={styles.wrapper}>

      {/* ── バー（白いピル） ─────────────────────── */}
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          function onPress() {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          }

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tab}
              onPress={onPress}
              activeOpacity={0.7}
            >
              {/* アクティブ時はインジケーター側にアイコンを出す → ここは非表示 */}
              <Text style={[styles.tabIcon, isFocused && styles.tabIconHidden]}>
                {TAB_ICONS[route.name] ?? "○"}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* ＋ボタン */}
        <TouchableOpacity style={styles.plusSlot} onPress={handlePlusPress} activeOpacity={0.85}>
          <View style={styles.plusBtn}>
            <Text style={styles.plusIcon}>+</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── インジケーター（バーの上に重ねる「穴」） ── */}
      <Animated.View
        style={[styles.indicator, { transform: [{ translateX: indicatorX }] }]}
      >
        {/* APP_BG 色の穴エリア → 白＋ボーダーの内円 */}
        <View style={styles.hole}>
          <View style={styles.innerCircle}>
            <Text style={styles.activeIcon}>{activeIcon}</Text>
          </View>
        </View>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 28 : 16,
    left: BAR_MARGIN,
    right: BAR_MARGIN,
    height: BAR_H,
  },

  // ─── バー
  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: BAR_H,
    flexDirection: "row",
    backgroundColor: BAR_BG,
    borderRadius: 28,
    alignItems: "center",
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: BAR_H,
  },
  tabIcon: {
    fontSize: 22,
    color: INACTIVE,
  },
  tabIconHidden: {
    opacity: 0,
  },
  plusSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  plusBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SECONDARY,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: SECONDARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  plusIcon: {
    fontSize: 28,
    color: "#fff",
    lineHeight: 32,
    fontWeight: "300",
  },

  // ─── インジケーター
  indicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: SLOT_W,
    height: BAR_H,
    alignItems: "center",
    justifyContent: "center",
  },

  // 「穴」本体：APP_BG 色でバーを上書きする
  hole: {
    width: CIRCLE_BG,
    height: CIRCLE_BG,
    borderRadius: CIRCLE_BG / 2,
    backgroundColor: APP_BG,
    alignItems: "center",
    justifyContent: "center",
  },

  // 白＋ PRIMARY ボーダーの内円
  innerCircle: {
    width: INNER_C,
    height: INNER_C,
    borderRadius: INNER_C / 2,
    backgroundColor: BAR_BG,
    borderWidth: 4,
    borderColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },

  activeIcon: {
    fontSize: 22,
    color: PRIMARY,
  },
});
