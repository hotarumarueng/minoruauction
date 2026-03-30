// API_BASE_URL は環境変数 EXPO_PUBLIC_API_URL から読み込む。
// 未設定の場合はローカル開発用の URL を使用する。
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
