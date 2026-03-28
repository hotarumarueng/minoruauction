// バックエンド API の Base URL を環境変数 EXPO_PUBLIC_API_BASE_URL から読み込む。
// Expo の規約: EXPO_PUBLIC_ プレフィックスの変数はクライアントバンドルに含まれる。
// ローカル開発時は .env.local に設定する。

const FALLBACK_URL = "http://localhost:3000";

// envVar を引数で受け取ることでテスト時に注入できる設計にする。
// 本番コードは process.env.EXPO_PUBLIC_API_BASE_URL をデフォルト引数として使う。
export function getApiBaseUrl(envVar = process.env["EXPO_PUBLIC_API_BASE_URL"]): string {
  const raw = envVar ?? FALLBACK_URL;
  return raw.replace(/\/$/, ""); // 末尾スラッシュを除去
}
