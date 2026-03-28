import type { Task, TaskStatus, Role, StatusEntry, CreateTaskRequest, UpdateTaskStatusRequest, UpdateTaskAmountRequest } from "../index";

// TypeScript の型テスト：コンパイルが通ること自体が検証
// 実行時アサーションは値の整合性チェックに使う

describe("TaskStatus", () => {
  it("許可されたステータス値を定数として保持する", () => {
    const statuses: TaskStatus[] = ["未入札", "入札済み", "要再入札", "落札"];
    expect(statuses).toHaveLength(4);
  });
});

describe("Role", () => {
  it("father と assignee の 2 種類を保持する", () => {
    const roles: Role[] = ["father", "assignee"];
    expect(roles).toHaveLength(2);
  });
});

describe("Task オブジェクト", () => {
  it("必須フィールドを持つ Task を構築できる", () => {
    const task: Task = {
      taskId: "01JXXXXXXXXXXXXXXXXXXXX",
      roomId: "ABC123",
      auctionUrl: "https://page.auctions.yahoo.co.jp/jp/auction/x000000000",
      requestedAmount: 5000,
      status: "未入札",
      bidAmount: null,
      statusHistory: [],
      createdAt: "2026-03-29T00:00:00.000Z",
      updatedAt: "2026-03-29T00:00:00.000Z",
    };
    expect(task.taskId).toBeTruthy();
    expect(task.status).toBe("未入札");
    expect(task.bidAmount).toBeNull();
  });
});

describe("StatusEntry オブジェクト", () => {
  it("ステータス履歴エントリを構築できる", () => {
    const entry: StatusEntry = {
      status: "入札済み",
      amount: 5000,
      timestamp: "2026-03-29T00:00:00.000Z",
    };
    expect(entry.status).toBe("入札済み");
    expect(entry.amount).toBe(5000);
  });

  it("amount が null の StatusEntry を構築できる", () => {
    const entry: StatusEntry = {
      status: "未入札",
      amount: null,
      timestamp: "2026-03-29T00:00:00.000Z",
    };
    expect(entry.amount).toBeNull();
  });
});

describe("API リクエスト型", () => {
  it("CreateTaskRequest を構築できる", () => {
    const req: CreateTaskRequest = {
      auctionUrl: "https://page.auctions.yahoo.co.jp/jp/auction/x000000000",
      requestedAmount: 5000,
    };
    expect(req.requestedAmount).toBe(5000);
  });

  it("UpdateTaskStatusRequest を構築できる（bidAmount 省略可）", () => {
    const req: UpdateTaskStatusRequest = { status: "入札済み", bidAmount: 4800 };
    expect(req.status).toBe("入札済み");

    const reqWithoutAmount: UpdateTaskStatusRequest = { status: "要再入札" };
    expect(reqWithoutAmount.bidAmount).toBeUndefined();
  });

  it("UpdateTaskAmountRequest を構築できる", () => {
    const req: UpdateTaskAmountRequest = { requestedAmount: 6000 };
    expect(req.requestedAmount).toBe(6000);
  });
});
