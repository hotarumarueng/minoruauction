import * as Notifications from "expo-notifications";
import type { RoomSession } from "../storage/roomStorage";
import type { ApiResult, Role } from "../types";

/**
 * 通知許可を要求し、デバイストークンを取得する。
 * 許可されなかった場合は null を返す。
 */
export async function requestAndGetToken(): Promise<string | null> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return null;
  const { data } = await Notifications.getDevicePushTokenAsync();
  return data;
}

/**
 * バックエンドにデバイストークンを登録・更新する。
 * updateFn を差し替えられるのでテスト可能。
 */
export async function refreshDeviceToken(
  session: RoomSession,
  token: string,
  updateFn: (roomId: string, role: Role, deviceToken: string) => Promise<ApiResult<unknown>>,
): Promise<void> {
  await updateFn(session.roomId, session.role, token);
}
