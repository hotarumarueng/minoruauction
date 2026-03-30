import React, { useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigationContainerRef } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { RoomSetupScreen } from "../screens/RoomSetupScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { TaskListScreen } from "../screens/TaskListScreen";
import { CreateTaskScreen } from "../screens/CreateTaskScreen";
import { TaskDetailScreen } from "../screens/TaskDetailScreen";
import { BottomTabBar } from "./BottomTabBar";
import { redirectIfSessionExists } from "./startupCheck";
import { requestAndGetToken, refreshDeviceToken } from "../notifications/tokenRegistration";
import { handleNotificationTap } from "../notifications/notificationHandler";
import { loadRoomSession } from "../storage/roomStorage";
import { updateToken } from "../api/room";

// ─── 型定義 ──────────────────────────────────────────────────

export type RootStackParamList = {
  RoomSetup: undefined;
  MainTabs: { roomId: string; role: "father" | "assignee" };
  TaskDetail: { roomId: string; taskId: string; role: "father" | "assignee" };
  CreateTask: { roomId: string; role: "father" | "assignee" };
};

export type TabParamList = {
  Home: { roomId: string; role: "father" | "assignee" };
  Tasks: { roomId: string; role: "father" | "assignee" };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// ─── タブナビゲーター ─────────────────────────────────────────

function MainTabs({ route }: { route: { params: { roomId: string; role: "father" | "assignee" } } }) {
  const { roomId, role } = route.params;

  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen as any}
        initialParams={{ roomId, role }}
      />
      <Tab.Screen
        name="Tasks"
        component={TaskListScreen as any}
        initialParams={{ roomId, role }}
      />
    </Tab.Navigator>
  );
}

// ─── ルートナビゲーター ───────────────────────────────────────

export function AppNavigator() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  async function handleNavigationReady() {
    const nav = navigationRef.current;
    if (!nav) return;
    const navigate = nav.navigate as (
      name: keyof RootStackParamList,
      params?: RootStackParamList[keyof RootStackParamList],
    ) => void;
    redirectIfSessionExists(navigate);
    const session = await loadRoomSession();
    if (session) {
      const token = await requestAndGetToken();
      if (token) await refreshDeviceToken(session, token, updateToken);
    }
  }

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const session = await loadRoomSession();
        const payload = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
        const nav = navigationRef.current;
        if (!nav) return;
        const navigate = nav.navigate as (
          name: keyof RootStackParamList,
          params?: RootStackParamList[keyof RootStackParamList],
        ) => void;
        handleNotificationTap(payload, navigate, session);
      },
    );
    return () => { subscription.remove(); };
  }, []);

  return (
    <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
      <Stack.Navigator initialRouteName="RoomSetup" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="RoomSetup" component={RoomSetupScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs as any} />
        <Stack.Screen
          name="TaskDetail"
          component={TaskDetailScreen}
          options={{ headerShown: true, title: "商品詳細" }}
        />
        <Stack.Screen
          name="CreateTask"
          component={CreateTaskScreen}
          options={{ headerShown: true, title: "商品を追加" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
