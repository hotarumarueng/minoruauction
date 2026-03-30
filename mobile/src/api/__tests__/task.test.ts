import { getTasks, createTask, updateTaskStatus, updateTaskAmount, deleteTask } from "../task";
import type { Task } from "../../types";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

afterEach(() => {
  mockFetch.mockReset();
});

const sampleTask: Task = {
  taskId: "01ABCDEF",
  roomId: "ABC123",
  auctionUrl: "https://page.auctions.yahoo.co.jp/jp/auction/x000000001",
  requestedAmount: 5000,
  status: "未入札",
  bidAmount: null,
  statusHistory: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

// ─── getTasks ──────────────────────────────────────────────────

describe("getTasks", () => {
  it("GET /rooms/{roomId}/tasks を呼び出してタスク一覧を返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tasks: [sampleTask] }),
    });

    const result = await getTasks("ABC123");

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].taskId).toBe("01ABCDEF");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rooms/ABC123/tasks"),
    );
  });

  it("サーバーエラー時は error を返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { code: "internalError", message: "内部エラー" } }),
    });

    const result = await getTasks("ABC123");

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("internalError");
  });

  it("ネットワークエラー時は error を返す", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await getTasks("ABC123");

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("networkError");
  });
});

// ─── createTask ────────────────────────────────────────────────

describe("createTask", () => {
  it("POST /rooms/{roomId}/tasks を呼び出して作成済みタスクを返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleTask,
    });

    const result = await createTask("ABC123", {
      auctionUrl: sampleTask.auctionUrl,
      requestedAmount: 5000,
    });

    expect(result.error).toBeNull();
    expect(result.data?.taskId).toBe("01ABCDEF");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rooms/ABC123/tasks"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("ネットワークエラー時は error を返す", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await createTask("ABC123", { auctionUrl: "https://example.com", requestedAmount: 1000 });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("networkError");
  });
});

// ─── updateTaskStatus ──────────────────────────────────────────

describe("updateTaskStatus", () => {
  it("PATCH /rooms/{roomId}/tasks/{taskId} を呼び出してステータス更新済みタスクを返す", async () => {
    const updated = { ...sampleTask, status: "入札済み" as const };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
    });

    const result = await updateTaskStatus("ABC123", "01ABCDEF", { status: "入札済み" });

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe("入札済み");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rooms/ABC123/tasks/01ABCDEF"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("不正遷移（422）時は error を返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { code: "invalidTransition", message: "不正なステータス遷移" } }),
    });

    const result = await updateTaskStatus("ABC123", "01ABCDEF", { status: "落札" });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("invalidTransition");
  });

  it("ネットワークエラー時は error を返す", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await updateTaskStatus("ABC123", "01ABCDEF", { status: "入札済み" });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("networkError");
  });
});

// ─── updateTaskAmount ──────────────────────────────────────────

describe("updateTaskAmount", () => {
  it("PATCH /rooms/{roomId}/tasks/{taskId}/amount を呼び出して金額更新済みタスクを返す", async () => {
    const updated = { ...sampleTask, requestedAmount: 8000, status: "未入札" as const };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
    });

    const result = await updateTaskAmount("ABC123", "01ABCDEF", { requestedAmount: 8000 });

    expect(result.error).toBeNull();
    expect(result.data?.requestedAmount).toBe(8000);
    expect(result.data?.status).toBe("未入札");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rooms/ABC123/tasks/01ABCDEF/amount"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("ネットワークエラー時は error を返す", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await updateTaskAmount("ABC123", "01ABCDEF", { requestedAmount: 8000 });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("networkError");
  });
});

// ─── deleteTask ──────────────────────────────────────────────

describe("deleteTask", () => {
  it("DELETE /rooms/{roomId}/tasks/{taskId} を呼び出して成功する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: { get: () => null },
    });

    const result = await deleteTask("ABC123", "task-01");

    expect(result.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rooms/ABC123/tasks/task-01"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("タスクが見つからない場合は error を返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: "taskNotFound", message: "タスクが見つかりません" } }),
      headers: { get: () => "application/json" },
    });

    const result = await deleteTask("ABC123", "nonexistent");

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("taskNotFound");
  });

  it("ネットワークエラー時は error を返す", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await deleteTask("ABC123", "task-01");

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("networkError");
  });
});
