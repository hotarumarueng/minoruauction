import { loadRoomSession } from "../storage/roomStorage";
import type { RootStackParamList } from "./index";

type NavigateFn = (name: keyof RootStackParamList, params: RootStackParamList[keyof RootStackParamList]) => void;

/**
 * AsyncStorage を確認し、接続済みセッションがあれば TaskList に遷移する。
 * 第2引数でローダーを差し替えられるのでテストから単体テスト可能。
 */
export async function redirectIfSessionExists(
  navigate: NavigateFn,
  loader: typeof loadRoomSession = loadRoomSession,
): Promise<void> {
  const session = await loader();
  if (session) {
    navigate("MainTabs", { roomId: session.roomId, role: session.role });
  }
}
