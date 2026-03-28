// デザイン書 §Data Contracts に定義された共有型

export type TaskStatus = "未入札" | "入札済み" | "要再入札" | "落札";
export type Role = "father" | "assignee";

export interface StatusEntry {
  status: TaskStatus;
  amount: number | null;
  timestamp: string; // ISO8601
}

export interface Task {
  taskId: string; // ULID
  roomId: string;
  auctionUrl: string;
  requestedAmount: number;
  status: TaskStatus;
  bidAmount: number | null;
  statusHistory: StatusEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  auctionUrl: string;
  requestedAmount: number;
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
  bidAmount?: number;
}

export interface UpdateTaskAmountRequest {
  requestedAmount: number;
}

export interface JoinRoomRequest {
  deviceToken: string;
  role: Role;
}

export interface UpdateTokenRequest {
  role: Role;
  deviceToken: string;
}

export type ApiResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string } };
