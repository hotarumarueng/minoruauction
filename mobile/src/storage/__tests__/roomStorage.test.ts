import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveRoomSession, loadRoomSession, clearRoomSession } from "../roomStorage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

afterEach(() => {
  jest.clearAllMocks();
});

// ─── saveRoomSession ───────────────────────────────────────────

describe("saveRoomSession", () => {
  it("roomId と role を JSON 形式で AsyncStorage に保存する", async () => {
    await saveRoomSession({ roomId: "ABC123", role: "father" });

    expect(mockStorage.setItem).toHaveBeenCalledWith(
      "room_session",
      JSON.stringify({ roomId: "ABC123", role: "father" }),
    );
  });

  it("assignee ロールも保存できる", async () => {
    await saveRoomSession({ roomId: "XYZ456", role: "assignee" });

    expect(mockStorage.setItem).toHaveBeenCalledWith(
      "room_session",
      JSON.stringify({ roomId: "XYZ456", role: "assignee" }),
    );
  });
});

// ─── loadRoomSession ───────────────────────────────────────────

describe("loadRoomSession", () => {
  it("保存済みセッションを RoomSession として返す", async () => {
    mockStorage.getItem.mockResolvedValueOnce(
      JSON.stringify({ roomId: "ABC123", role: "father" }),
    );

    const session = await loadRoomSession();

    expect(session?.roomId).toBe("ABC123");
    expect(session?.role).toBe("father");
  });

  it("セッション未保存のとき null を返す", async () => {
    mockStorage.getItem.mockResolvedValueOnce(null);

    const session = await loadRoomSession();

    expect(session).toBeNull();
  });
});

// ─── clearRoomSession ──────────────────────────────────────────

describe("clearRoomSession", () => {
  it("room_session キーを AsyncStorage から削除する", async () => {
    await clearRoomSession();

    expect(mockStorage.removeItem).toHaveBeenCalledWith("room_session");
  });
});
