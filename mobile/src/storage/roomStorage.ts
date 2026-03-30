import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Role } from "../types";

export interface RoomSession {
  roomId: string;
  role: Role;
}

const ROOM_SESSION_KEY = "room_session";

/** 参加済みルームのセッション情報を永続化する */
export async function saveRoomSession(session: RoomSession): Promise<void> {
  await AsyncStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(session));
}

/** 保存済みセッションを読み込む。未保存・破損データの場合は null を返す */
export async function loadRoomSession(): Promise<RoomSession | null> {
  try {
    const raw = await AsyncStorage.getItem(ROOM_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // 型チェック: 破損データや旧フォーマットに対してアプリ起動クラッシュを防ぐ
    if (typeof parsed?.roomId !== "string" || typeof parsed?.role !== "string") return null;
    return parsed as RoomSession;
  } catch {
    return null;
  }
}

/** セッションを削除する（ルーム退出時など） */
export async function clearRoomSession(): Promise<void> {
  await AsyncStorage.removeItem(ROOM_SESSION_KEY);
}
