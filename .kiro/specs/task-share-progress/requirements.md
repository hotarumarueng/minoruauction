# 要件定義書

## はじめに

父と自分の2人専用の入札代行管理アプリ。父がオークションURLと希望金額を投稿し、自分が入札を代行してステータスを1タップで報告する。ヤフオクAPIで最高入札者の確認を自動化し、進捗をリアルタイムに把握できる。

## 前提

- ユーザー数：2人固定（父・自分）
- 認証：なし。招待コードによる接続のみ
- 対象オークション：ヤフオク

---

## 要件

### 要件 1: ルーム接続

**目的：** 招待コードを使って2人が接続し、切断操作をしない限り永続的に接続を維持する。

#### 受け入れ基準
1. When one user generates an invite code, the App shall create a persistent room and display a 6-character code.
2. When the other user enters the invite code, the App shall join the room and establish a connection between both users.
3. The App shall maintain the room connection across app restarts without requiring re-entry of the invite code.
4. If an invalid invite code is entered, the App shall display an error message.

---

### 要件 2: タスク投稿

**目的：** 父がオークションURLと希望入札金額を投稿し、自分に依頼を送る。

#### 受け入れ基準
1. When a user taps "依頼する", the App shall display a form for auction URL and bid amount.
2. The App shall require both auction URL and bid amount before allowing submission.
3. When a task is submitted, the App shall notify the other user via push notification.
4. When a task is opened, the App shall fetch current price and highest bidder status from the Yahoo Auction API and display them.

---

### 要件 3: 進捗更新

**目的：** 自分が入札結果を1タップで報告し、父が状況を把握できるようにする。

#### ステータス定義
| ステータス | 意味 | 操作者 |
|---|---|---|
| 未入札 | 依頼が届いた初期状態 | 自動 |
| 入札済み | 指定金額で入札完了 | 自分（1タップ） |
| 要再入札 | 上回られた・再入札が必要 | 自分（1タップ） |
| 落札 | 入札に勝ち、落札確定 | 自分（1タップ） |

#### 受け入れ基準
1. When viewing a task, the App shall display the current bid amount as a tappable button.
2. When the bid amount button is tapped, the App shall update the status to "入札済み" with the tapped amount.
3. When the user taps "要再入札", the App shall update the status and send a push notification to the requester.
4. When the user taps "落札", the App shall mark the task as complete and send a push notification.
5. The App shall allow the status cycle to repeat: 入札済み → 要再入札 → 入札済み as many times as needed.
6. When the Yahoo Auction API confirms the user is the current highest bidder, the App shall display a "最高入札中" badge on the task.

---

### 要件 4: 進捗確認

**目的：** 両者がタスク一覧と各タスクのステータスを確認できる。

#### 受け入れ基準
1. The App shall display a task list showing all tasks with current status and auction end time.
2. When a task is tapped, the App shall display the full status history and current Yahoo Auction data.
3. The App shall visually distinguish statuses (未入札 = グレー、入札済み = ブルー、要再入札 = オレンジ、落札 = グリーン).
4. When a requester posts a new bid amount on an existing task, the App shall reset the status to "未入札" and notify the assignee.

---

### 要件 5: プッシュ通知

**目的：** ステータス変更時にアプリを開かなくても相手に伝わる。

#### 受け入れ基準
1. When a new task is created, the App shall send a push notification to the assignee.
2. When status changes to "要再入札", the App shall send a push notification to the requester.
3. When status changes to "落札", the App shall send a push notification to the requester.
4. When a push notification is tapped, the App shall open and navigate directly to the relevant task.
