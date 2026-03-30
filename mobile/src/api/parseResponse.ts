/**
 * レスポンスを安全にパースする。
 * 204 No Content や明示的に non-JSON な content-type で res.json() が例外になるのを防ぐ。
 * content-type が取得できない場合（テストモック等）は JSON パースを試みる。
 */
export async function parseResponse(res: Response): Promise<unknown> {
  if (res.status === 204) return {};
  // optional chaining: テストのモック response には headers が存在しないことがある
  const ct: string = (res.headers as any)?.get?.("content-type") ?? "";
  // content-type が明示的に non-JSON の場合のみスキップ（空文字 = 判断不能 → JSON を試みる）
  if (ct && !ct.includes("application/json")) return {};
  return res.json();
}
