package task

// TaskStatus はタスクのステータスを表す列挙型。
type TaskStatus string

const (
	StatusUnbid TaskStatus = "未入札"
	StatusBid   TaskStatus = "入札済み"
	StatusRebid TaskStatus = "要再入札"
	StatusWon   TaskStatus = "落札"
)

// StatusEntry はステータス変更履歴の1エントリ。
type StatusEntry struct {
	Status    TaskStatus `json:"status"              dynamodbav:"status"`
	Amount    *int64     `json:"amount,omitempty"    dynamodbav:"amount,omitempty"`
	Timestamp string     `json:"timestamp"           dynamodbav:"timestamp"`
}

// Task は DynamoDB の tasks テーブルに対応するドメインモデル。
type Task struct {
	RoomID          string        `json:"roomId"           dynamodbav:"roomId"`
	TaskID          string        `json:"taskId"           dynamodbav:"taskId"`
	AuctionURL      string        `json:"auctionUrl"       dynamodbav:"auctionUrl"`
	RequestedAmount int64         `json:"requestedAmount"  dynamodbav:"requestedAmount"`
	Status          TaskStatus    `json:"status"           dynamodbav:"status"`
	BidAmount       *int64        `json:"bidAmount,omitempty" dynamodbav:"bidAmount,omitempty"`
	StatusHistory   []StatusEntry `json:"statusHistory"    dynamodbav:"statusHistory"`
	CreatedAt       string        `json:"createdAt"        dynamodbav:"createdAt"`
	UpdatedAt       string        `json:"updatedAt"        dynamodbav:"updatedAt"`
}

// CreateTaskRequest は POST /rooms/{roomId}/tasks のリクエストボディ。
type CreateTaskRequest struct {
	AuctionURL      string `json:"auctionUrl"`
	RequestedAmount int64  `json:"requestedAmount"`
}

// UpdateTaskStatusRequest は PATCH /rooms/{roomId}/tasks/{taskId} のリクエストボディ。
type UpdateTaskStatusRequest struct {
	Status    TaskStatus `json:"status"`
	BidAmount *int64     `json:"bidAmount,omitempty"`
}

// UpdateTaskAmountRequest は PATCH /rooms/{roomId}/tasks/{taskId}/amount のリクエストボディ。
type UpdateTaskAmountRequest struct {
	RequestedAmount int64 `json:"requestedAmount"`
}

// TaskListResponse は GET /rooms/{roomId}/tasks のレスポンス。
type TaskListResponse struct {
	Tasks []Task `json:"tasks"`
}
