import type { ApiResult, Task, CreateTaskRequest, UpdateTaskStatusRequest, UpdateTaskAmountRequest } from "../types";
import { API_BASE_URL } from "./config";
import { parseResponse } from "./parseResponse";

/** GET /rooms/{roomId}/tasks — タスク一覧を取得する */
export async function getTasks(roomId: string): Promise<ApiResult<Task[]>> {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/tasks`);
    const data = await parseResponse(res);
    if (!res.ok) return { data: null, error: (data as any).error };
    return { data: (data as any).tasks as Task[], error: null };
  } catch {
    return {
      data: null,
      error: { code: "networkError", message: "ネットワークエラーが発生しました" },
    };
  }
}

/** POST /rooms/{roomId}/tasks — タスクを作成する */
export async function createTask(
  roomId: string,
  req: CreateTaskRequest,
): Promise<ApiResult<Task>> {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    const data = await parseResponse(res);
    if (!res.ok) return { data: null, error: (data as any).error };
    return { data: data as Task, error: null };
  } catch {
    return {
      data: null,
      error: { code: "networkError", message: "ネットワークエラーが発生しました" },
    };
  }
}

/** PATCH /rooms/{roomId}/tasks/{taskId} — ステータスを更新する */
export async function updateTaskStatus(
  roomId: string,
  taskId: string,
  req: UpdateTaskStatusRequest,
): Promise<ApiResult<Task>> {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    const data = await parseResponse(res);
    if (!res.ok) return { data: null, error: (data as any).error };
    return { data: data as Task, error: null };
  } catch {
    return {
      data: null,
      error: { code: "networkError", message: "ネットワークエラーが発生しました" },
    };
  }
}

/** DELETE /rooms/{roomId}/tasks/{taskId} — タスクを削除する */
export async function deleteTask(
  roomId: string,
  taskId: string,
): Promise<ApiResult<null>> {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/tasks/${taskId}`, {
      method: "DELETE",
    });
    if (res.status === 204) return { data: null, error: null };
    const data = await parseResponse(res);
    return { data: null, error: (data as any).error };
  } catch {
    return {
      data: null,
      error: { code: "networkError", message: "ネットワークエラーが発生しました" },
    };
  }
}

/** PATCH /rooms/{roomId}/tasks/{taskId}/amount — 希望金額を更新する */
export async function updateTaskAmount(
  roomId: string,
  taskId: string,
  req: UpdateTaskAmountRequest,
): Promise<ApiResult<Task>> {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/tasks/${taskId}/amount`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    const data = await parseResponse(res);
    if (!res.ok) return { data: null, error: (data as any).error };
    return { data: data as Task, error: null };
  } catch {
    return {
      data: null,
      error: { code: "networkError", message: "ネットワークエラーが発生しました" },
    };
  }
}
