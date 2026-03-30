import { createRoom, joinRoom, updateToken } from "../room";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

afterEach(() => {
  mockFetch.mockReset();
});

// ─── createRoom ────────────────────────────────────────────────

describe("createRoom", () => {
  it("POST /rooms を呼び出して roomId を返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roomId: "ABC123" }),
    });

    const result = await createRoom();

    expect(result.error).toBeNull();
    expect(result.data?.roomId).toBe("ABC123");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rooms"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("サーバーエラー時は error を返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { code: "internalError", message: "内部エラー" } }),
    });

    const result = await createRoom();

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("internalError");
  });

  it("ネットワークエラー時は error を返す", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await createRoom();

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("networkError");
  });
});

// ─── joinRoom ──────────────────────────────────────────────────

describe("joinRoom", () => {
  it("POST /rooms/{roomId}/join を呼び出してレスポンスを返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roomId: "ABC123", role: "father" }),
    });

    const result = await joinRoom("ABC123", "father", "device-token");

    expect(result.error).toBeNull();
    expect(result.data?.roomId).toBe("ABC123");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rooms/ABC123/join"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("存在しないルームID は roomNotFound エラーを返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { code: "roomNotFound", message: "ルームが見つかりません" },
      }),
    });

    const result = await joinRoom("NOTEX", "father", "token");

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("roomNotFound");
  });

  it("ルーム満員（409）は roomFull エラーを返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { code: "roomFull", message: "このルームは既に2名が参加しています" },
      }),
    });

    const result = await joinRoom("ABC123", "father", "token");

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("roomFull");
  });

  it("ネットワークエラー時は error を返す", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await joinRoom("ABC123", "father", "token");

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("networkError");
  });
});

// ─── updateToken ───────────────────────────────────────────────

describe("updateToken", () => {
  it("PATCH /rooms/{roomId}/token を呼び出す", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const result = await updateToken("ABC123", "father", "fcm-token-xyz");

    expect(result.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rooms/ABC123/token"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("ネットワークエラー時は error を返す", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await updateToken("ABC123", "assignee", "token");

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("networkError");
  });
});
