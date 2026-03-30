# Implementation Plan

> **デファード要件**: 要件 2.4・3.6（ヤフオクAPI連携）は API 終了済みのためスコープ外。詳細は research.md 参照。

---

- [x] 1. プロジェクト基盤の構築
- [x] 1.1 AWS CDK でインフラ基盤を構築する
  - DynamoDB の rooms テーブル（PK: roomId）と tasks テーブル（PK: roomId, SK: taskId）を定義する
  - API Gateway HTTP API と Lambda 関数スタブ（RoomHandler・TaskHandler）を CDK で定義する
  - Lambda ランタイムは `provided.al2023`・アーキテクチャは `arm64` に設定する
  - CDK スタック全体を `cdk synth` で検証できる状態にする
  - _Requirements: 1.1, 1.2, 2.2_

- [x] 1.2 (P) Go バックエンドのプロジェクト構造を整える
  - Go モジュールを初期化し、aws-lambda-go と AWS SDK v2 の依存関係を追加する
  - RoomHandler・TaskHandler それぞれのエントリポイント（`bootstrap` ビルドターゲット）を用意する
  - DynamoDB アクセス用の共通クライアント設定と、全エンドポイント共通のエラーレスポンス形式を実装する
  - `arm64` 向けのクロスコンパイルビルドスクリプトを用意する
  - _Requirements: 1.1, 2.2_

- [x] 1.3 (P) React Native Expo プロジェクトを初期化する
  - Expo SDK（TypeScript テンプレート）でプロジェクトを作成し、React Navigation を設定する
  - デザイン書で定義した TypeScript 型（`Task`・`TaskStatus`・`Role` 等）を共有型ファイルに配置する
  - バックエンド API の Base URL を環境変数で管理できる設定を追加する
  - _Requirements: 1.3, 2.1, 3.1_

---

- [x] 2. ルーム接続バックエンドの実装
- [x] 2.1 ルーム作成エンドポイントを実装する
  - `POST /rooms` で 6 文字英数字のルーム ID を生成し DynamoDB に保存する
  - レスポンスに `roomId` を含める
  - _Requirements: 1.1_

- [x] 2.2 (P) ルーム参加エンドポイントを実装する
  - `POST /rooms/{roomId}/join` で招待コードの存在チェックを行い、デバイストークンとロール（`father` / `assignee`）を rooms テーブルに保存する
  - 存在しないルーム ID は 404、3 名目の参加は 409 で返す
  - _Requirements: 1.2, 1.4_

- [x] 2.3 (P) デバイストークン更新エンドポイントを実装する
  - `PATCH /rooms/{roomId}/token` でロール別のデバイストークンを上書き保存する
  - FCM トークン更新時に既存の SNS Platform Endpoint ARN も更新できる構造にする
  - _Requirements: 1.3_

---

- [x] 3. タスク管理バックエンドの実装
- [x] 3.1 タスク一覧取得・タスク作成エンドポイントを実装する
  - `GET /rooms/{roomId}/tasks` で roomId でクエリし、タスク一覧を返す
  - `POST /rooms/{roomId}/tasks` でオークション URL と希望金額を受け取り、`status: 未入札` でタスクを作成する
  - タスク ID には ULID を使い、時系列ソートが機能することを確認する
  - _Requirements: 2.2, 4.1_

- [x] 3.2 (P) ステータス更新エンドポイントを状態遷移バリデーション付きで実装する
  - `PATCH /rooms/{roomId}/tasks/{taskId}` でステータス変更を受け付ける
  - デザイン書の遷移マップ（未入札→入札済み→要再入札→入札済み / 入札済み→落札）に従い、不正遷移は 422 で返す
  - 変更前後のステータスを `statusHistory` にタイムスタンプとともに追記する
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [x] 3.3 (P) 希望金額更新エンドポイントを実装する
  - `PATCH /rooms/{roomId}/tasks/{taskId}/amount` で `requestedAmount` を更新し、同時に `status` を `未入札` にリセットする
  - `statusHistory` にもリセットイベントを記録する
  - _Requirements: 4.4_

---

- [x] 4. プッシュ通知バックエンドの構築
- [x] 4.1 SNS Platform Application を CDK で構成する
  - FCM v1（Service Account JSON）と APNs（AuthKey）用の SNS Platform Application を CDK で定義する
  - Service Account JSON は AWS Secrets Manager に保存し、Lambda 実行ロールから参照できるようにする
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4.2 タスクハンドラーにプッシュ通知発行を組み込む
  - タスク作成時（`POST /tasks`）に担当者の SNS Endpoint ARN へ Publish する
  - `要再入札` ステータスへの変更時に父の SNS Endpoint ARN へ Publish する
  - `落札` ステータスへの変更時に父の SNS Endpoint ARN へ Publish する
  - SNS Publish 失敗はログ記録のみとし、タスク更新の成功・失敗に影響させない
  - _Requirements: 2.3, 5.1, 5.2, 5.3_

---

- [x] 5. ルーム接続フロントエンドの構築
- [x] 5.1 (P) ルーム作成画面を実装する
  - 「新しいルームを作成」ボタンで `POST /rooms` を呼び出し、返ってきた 6 文字コードを大きく表示する
  - コピーボタンまたはシェアシートでコードを共有できるようにする
  - _Requirements: 1.1_

- [x] 5.2 (P) ルーム参加画面を実装する
  - 招待コード入力フィールドと「参加する」ボタンを配置し、`POST /rooms/{id}/join` を呼び出す
  - 存在しないコードは「このコードは無効です」エラーとして画面に表示する
  - _Requirements: 1.2, 1.4_

- [x] 5.3 ルーム接続をデバイスに永続化する
  - 参加に成功したら `roomId` とロールを AsyncStorage に保存する
  - アプリ起動時に AsyncStorage を確認し、接続済みの場合はコード入力なしでタスク一覧に遷移する
  - _Requirements: 1.3_

---

- [x] 6. タスク管理フロントエンドの構築
- [x] 6.1 (P) タスク一覧画面を実装する
  - `GET /rooms/{id}/tasks` を 30 秒間隔でポーリングし、タスク一覧を表示する
  - 各タスク行にステータスカラー（未入札=グレー、入札済み=ブルー、要再入札=オレンジ、落札=グリーン）を適用する
  - タスク行タップでタスク詳細画面に遷移する
  - _Requirements: 4.1, 4.3_

- [x] 6.2 (P) タスク作成フォーム画面を実装する
  - オークション URL と希望金額の入力フィールドを配置し、両方が入力されるまで送信ボタンを無効にする
  - 送信成功後にタスク一覧に戻り、新しいタスクが表示されることを確認する
  - _Requirements: 2.1, 2.2_

- [x] 6.3 タスク詳細画面を実装する
  - 現在の希望金額を大きくタップ可能なボタンとして表示し、タップで「入札済み」ステータスに更新する
  - 「要再入札」ボタンと「落札」ボタンを配置し、それぞれのステータスに更新する
  - ステータス更新履歴を時系列リストで表示する
  - ヤフオクURLは「ヤフオクで見る」リンクとしてブラウザを開くようにする（Req 2.4 のデファード対応）
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.2_

---

- [x] 7. プッシュ通知フロントエンドの統合
- [x] 7.1 アプリ起動時に FCM デバイストークンを登録する
  - expo-notifications で FCM トークンを取得し、`PATCH /rooms/{id}/token` でバックエンドに登録する
  - アプリを起動するたびに最新のトークンを送信し、トークンの失効を防ぐ
  - iOS では通知許可ダイアログを表示し、拒否された場合はその旨をユーザーに伝える
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 7.2 通知タップでタスク詳細画面に遷移する
  - `addNotificationResponseReceivedListener` で通知タップを受け取り、ペイロードの `taskId` を使ってタスク詳細画面に遷移する
  - アプリがバックグラウンドにいる場合もフォアグラウンドにいる場合も正しく遷移することを確認する
  - _Requirements: 5.4_

---

- [ ] 8. エンドツーエンド統合と検証
- [ ] 8.1 フロントエンドを実際のバックエンドに接続して全フローを通す
  - ルーム作成 → 招待コードで参加 → タスク作成 → ステータス更新サイクルを実機で確認する
  - 父ロール端末と担当者ロール端末の 2 台で動作することを検証する
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.2, 3.5, 4.1, 4.3_

- [ ] 8.2 プッシュ通知のエンドツーエンド配信を検証する
  - タスク作成時に担当者端末へ通知が届くことを確認する
  - 「要再入札」「落札」更新時に父端末へ通知が届くことを確認する
  - 通知タップでタスク詳細画面へ正しく遷移することを確認する
  - _Requirements: 2.3, 5.1, 5.2, 5.3, 5.4_

- [x] * 8.3 ステータス遷移バリデーションの単体テストを書く
  - 全許可遷移（未入札→入札済み 等）が正しく受け入れられることをテストする
  - 全不正遷移（落札→入札済み 等）が 422 を返すことをテストする
  - _Requirements: 3.2, 3.3, 3.4, 3.5_
