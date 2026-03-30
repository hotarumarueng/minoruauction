import { requestAndGetToken, refreshDeviceToken } from "../tokenRegistration";
import * as Notifications from "expo-notifications";

jest.mock("expo-notifications", () => ({
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
}));

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

afterEach(() => {
  jest.clearAllMocks();
});

// ─── requestAndGetToken ────────────────────────────────────────

describe("requestAndGetToken", () => {
  it("許可された場合はデバイストークン文字列を返す", async () => {
    mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({
      status: "granted",
    } as any);
    mockNotifications.getDevicePushTokenAsync.mockResolvedValueOnce({
      type: "android",
      data: "fcm-device-token-xyz",
    } as any);

    const token = await requestAndGetToken();

    expect(token).toBe("fcm-device-token-xyz");
  });

  it("許可拒否の場合は null を返す", async () => {
    mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({
      status: "denied",
    } as any);

    const token = await requestAndGetToken();

    expect(token).toBeNull();
    expect(mockNotifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
  });

  it("undetermined（未回答）の場合も null を返す", async () => {
    mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({
      status: "undetermined",
    } as any);

    const token = await requestAndGetToken();

    expect(token).toBeNull();
  });
});

// ─── refreshDeviceToken ────────────────────────────────────────

describe("refreshDeviceToken", () => {
  it("updateFn に roomId / role / token を渡して呼び出す", async () => {
    const mockUpdate = jest.fn().mockResolvedValue({ data: undefined, error: null });

    await refreshDeviceToken(
      { roomId: "ABC123", role: "father" },
      "fcm-token-xyz",
      mockUpdate,
    );

    expect(mockUpdate).toHaveBeenCalledWith("ABC123", "father", "fcm-token-xyz");
  });

  it("assignee ロールでも正しく呼び出す", async () => {
    const mockUpdate = jest.fn().mockResolvedValue({ data: undefined, error: null });

    await refreshDeviceToken(
      { roomId: "XYZ456", role: "assignee" },
      "fcm-token-abc",
      mockUpdate,
    );

    expect(mockUpdate).toHaveBeenCalledWith("XYZ456", "assignee", "fcm-token-abc");
  });
});
