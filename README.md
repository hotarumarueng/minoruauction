# minoruauction

オークション中毒の父と私をつなぐ、入札代行コミュニケーションツール。

## どんなアプリ？

1. **父が出品を見つける** → URLと希望金額を送信
2. **私が確認する** → 金額をチェックして入札を実行
3. **結果を父に通知**
   - ✅ 指定金額で入札完了（最高入札者）
   - ❌ 指定金額では最高入札者になれなかった

父は歓喜するか、落胆する。

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo) |
| Backend | Go (AWS Lambda) |
| Infra | AWS CDK (TypeScript) |
| DB | DynamoDB |

## Project Structure

```
.
├── mobile/     # React Native アプリ
├── backend/    # Go Lambda 関数
└── infra/      # AWS CDK インフラ定義
```

## Status

🚧 Work in progress

---

*個人開発 & 学習プロジェクトです。*
