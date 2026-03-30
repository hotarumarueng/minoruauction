import * as fs from "fs";
import * as path from "path";

// ソースコードレベルのテスト:
// TaskListScreen.tsx に FAB (fab スタイル / 全角プラス) が含まれないことを確認
// これにより「BottomTabBar に委譲済み」という設計意図をコードで保証する

const SCREEN_PATH = path.resolve(
  __dirname,
  "../TaskListScreen.tsx"
);

describe("TaskListScreen ソースコード検証", () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SCREEN_PATH, "utf-8");
  });

  it("father ロールでも TaskListScreen に独立した FAB ボタンが存在しない（BottomTabBar に委譲）", () => {
    // fabText "＋"（全角プラス）が JSX 内に存在しないことを確認
    // BottomTabBar の + は TaskListScreen の外なので影響しない
    expect(source).not.toContain("＋");
  });

  it("styles に fab エントリが存在しない", () => {
    // StyleSheet.create 内に fab: { ... } が定義されていないことを確認
    expect(source).not.toMatch(/\bfab\s*:/);
  });

  it("TaskDetail への navigate は残っている", () => {
    // TaskDetail 画面への遷移は引き続き存在することを確認
    expect(source).toContain('"TaskDetail"');
  });
});
