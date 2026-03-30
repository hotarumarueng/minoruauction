import React from "react";
import { act } from "react-test-renderer";
import renderer from "react-test-renderer";
import { CreateTaskScreen } from "../CreateTaskScreen";
import * as taskApi from "../../api/task";

jest.mock("../../api/task", () => ({
  createTask: jest.fn(),
}));

// react-native-safe-area-context のモック
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

const mockNavigation = {
  goBack: mockGoBack,
  navigate: mockNavigate,
};

const mockRoute = {
  params: { roomId: "ABC123", role: "father" as const },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("CreateTaskScreen - handleSubmit のナビゲーション", () => {
  it("タスク作成成功後に goBack() を呼ぶ (navigate を呼ばない)", async () => {
    (taskApi.createTask as jest.Mock).mockResolvedValue({
      data: { taskId: "task-01" },
      error: null,
    });

    let instance: renderer.ReactTestRenderer;
    await act(async () => {
      instance = renderer.create(
        <CreateTaskScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />
      );
    });

    const root = instance!.root;
    const textInputs = root.findAllByType("TextInput" as any);

    // URLを入力（rawInputフィールド）
    await act(async () => {
      textInputs[0].props.onChangeText(
        "https://page.auctions.yahoo.co.jp/jp/auction/x000000001"
      );
    });

    // 金額を入力（amountTextフィールド）
    await act(async () => {
      textInputs[1].props.onChangeText("5000");
    });

    // onPress を持つノードを探して disabled でないボタンを押す
    const pressableNodes = root.findAll(
      (node: any) => node.props && node.props.onPress !== undefined && !node.props.disabled
    );

    expect(pressableNodes.length).toBeGreaterThan(0);

    await act(async () => {
      await pressableNodes[pressableNodes.length - 1].props.onPress();
    });

    // Promiseの解決を待つ
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // goBack が呼ばれ、navigate は呼ばれないことを確認
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("タスク作成失敗時は goBack() も navigate() も呼ばない", async () => {
    (taskApi.createTask as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: "サーバーエラー" },
    });

    let instance: renderer.ReactTestRenderer;
    await act(async () => {
      instance = renderer.create(
        <CreateTaskScreen
          navigation={mockNavigation as any}
          route={mockRoute as any}
        />
      );
    });

    const root = instance!.root;
    const textInputs = root.findAllByType("TextInput" as any);

    await act(async () => {
      textInputs[0].props.onChangeText(
        "https://page.auctions.yahoo.co.jp/jp/auction/x000000001"
      );
    });
    await act(async () => {
      textInputs[1].props.onChangeText("5000");
    });

    const pressableNodes = root.findAll(
      (node: any) => node.props && node.props.onPress !== undefined && !node.props.disabled
    );

    await act(async () => {
      await pressableNodes[pressableNodes.length - 1].props.onPress();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
