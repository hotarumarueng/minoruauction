import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// 画面コンポーネントはタスク 5.x・6.x で実装予定
// ここでは型定義とナビゲーター構造のみ定義する

export type RootStackParamList = {
  RoomSetup: undefined;
  TaskList: { roomId: string; role: "father" | "assignee" };
  TaskDetail: { roomId: string; taskId: string };
  CreateTask: { roomId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// PlaceholderScreen: 各画面の実装が完了するまでのスタブ
function PlaceholderScreen() {
  return null;
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="RoomSetup">
        <Stack.Screen name="RoomSetup" component={PlaceholderScreen} options={{ title: "接続" }} />
        <Stack.Screen name="TaskList" component={PlaceholderScreen} options={{ title: "タスク一覧" }} />
        <Stack.Screen name="TaskDetail" component={PlaceholderScreen} options={{ title: "タスク詳細" }} />
        <Stack.Screen name="CreateTask" component={PlaceholderScreen} options={{ title: "タスク作成" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
