import { handleNotificationTap } from "../notificationHandler";

const mockNavigate = jest.fn();
const session = { roomId: "ABC123", role: "father" as const };

afterEach(() => {
  jest.clearAllMocks();
});

describe("handleNotificationTap", () => {
  it("ペイロードの taskId を使って TaskDetail に navigate する", () => {
    handleNotificationTap({ taskId: "TASK01" }, mockNavigate, session);

    expect(mockNavigate).toHaveBeenCalledWith("TaskDetail", {
      roomId: "ABC123",
      taskId: "TASK01",
      role: "father",
    });
  });

  it("assignee セッションでも正しく navigate する", () => {
    handleNotificationTap(
      { taskId: "TASK99" },
      mockNavigate,
      { roomId: "XYZ456", role: "assignee" },
    );

    expect(mockNavigate).toHaveBeenCalledWith("TaskDetail", {
      roomId: "XYZ456",
      taskId: "TASK99",
      role: "assignee",
    });
  });

  it("taskId がペイロードに含まれない場合は navigate しない", () => {
    handleNotificationTap({}, mockNavigate, session);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("session が null の場合は navigate しない", () => {
    handleNotificationTap({ taskId: "TASK01" }, mockNavigate, null);

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
