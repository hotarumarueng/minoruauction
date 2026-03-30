import type { ApiResult, Role, UpdateTokenRequest } from "../types";
import { API_BASE_URL } from "./config";
import { parseResponse } from "./parseResponse";

export interface RoomResponse {
  roomId: string;
}

export interface JoinRoomResponse {
  roomId: string;
  role: Role;
}

/** POST /rooms — 新しいルームを作成して roomId を返す */
export async function createRoom(): Promise<ApiResult<RoomResponse>> {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms`, { method: "POST" });
    const data = await parseResponse(res);
    if (!res.ok) return { data: null, error: (data as any).error };
    return { data: data as RoomResponse, error: null };
  } catch {
    return {
      data: null,
      error: { code: "networkError", message: "ネットワークエラーが発生しました" },
    };
  }
}

/** PATCH /rooms/{roomId}/token — デバイストークンを更新する */
export async function updateToken(
  roomId: string,
  role: Role,
  deviceToken: string,
): Promise<ApiResult<void>> {
  const body: UpdateTokenRequest = { role, deviceToken };
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/token`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await parseResponse(res);
    if (!res.ok) return { data: null, error: (data as any).error };
    return { data: undefined, error: null };
  } catch {
    return {
      data: null,
      error: { code: "networkError", message: "ネットワークエラーが発生しました" },
    };
  }
}

/** POST /rooms/{roomId}/join — 招待コードでルームに参加する */
export async function joinRoom(
  roomId: string,
  role: Role,
  deviceToken: string,
): Promise<ApiResult<JoinRoomResponse>> {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, deviceToken }),
    });
    const data = await parseResponse(res);
    if (!res.ok) return { data: null, error: (data as any).error };
    return { data: data as JoinRoomResponse, error: null };
  } catch {
    return {
      data: null,
      error: { code: "networkError", message: "ネットワークエラーが発生しました" },
    };
  }
}
