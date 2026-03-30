import { redirectIfSessionExists } from "../startupCheck";

// roomStorage が import する native module をスタブ化
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockNavigate = jest.fn();

afterEach(() => {
  jest.clearAllMocks();
});

describe("redirectIfSessionExists", () => {
  it("セッションが存在する場合 TaskList に navigate する", async () => {
    const mockLoader = jest.fn().mockResolvedValue({ roomId: "ABC123", role: "father" });

    await redirectIfSessionExists(mockNavigate, mockLoader);

    expect(mockNavigate).toHaveBeenCalledWith("TaskList", {
      roomId: "ABC123",
      role: "father",
    });
  });

  it("assignee ロールでもセッションがあれば TaskList に navigate する", async () => {
    const mockLoader = jest.fn().mockResolvedValue({ roomId: "XYZ456", role: "assignee" });

    await redirectIfSessionExists(mockNavigate, mockLoader);

    expect(mockNavigate).toHaveBeenCalledWith("TaskList", {
      roomId: "XYZ456",
      role: "assignee",
    });
  });

  it("セッションが存在しない場合は navigate しない", async () => {
    const mockLoader = jest.fn().mockResolvedValue(null);

    await redirectIfSessionExists(mockNavigate, mockLoader);

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
