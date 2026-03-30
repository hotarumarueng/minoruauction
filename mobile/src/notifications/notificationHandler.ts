import type { RoomSession } from "../storage/roomStorage";
import type { RootStackParamList } from "../navigation";

type NavigateFn = (name: keyof RootStackParamList, params: RootStackParamList[keyof RootStackParamList]) => void;

/**
 * 通知タップ時のペイロードを受け取り、TaskDetail 画面へ遷移する。
 * session が null、または payload に taskId がない場合は何もしない。
 */
export function handleNotificationTap(
  payload: Record<string, unknown>,
  navigate: NavigateFn,
  session: RoomSession | null,
): void {
  if (!session) return;
  // typeof で検証してからナビゲート（任意の値が来ても型安全）
  const taskId = typeof payload.taskId === "string" ? payload.taskId : undefined;
  if (!taskId) return;
  navigate("TaskDetail", { roomId: session.roomId, taskId, role: session.role });
}
