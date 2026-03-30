package room

// Room は DynamoDB の rooms テーブルに対応するドメインモデル。
type Room struct {
	RoomID       string            `dynamodbav:"roomId"`
	MemberTokens map[string]string `dynamodbav:"memberTokens"`
	CreatedAt    string            `dynamodbav:"createdAt"`
	ExpireAt     int64             `dynamodbav:"expireAt"` // Unix timestamp。DynamoDB TTL で自動削除される。
}

// JoinRoomRequest は POST /rooms/{roomId}/join のリクエストボディ。
type JoinRoomRequest struct {
	DeviceToken string `json:"deviceToken"`
	Role        string `json:"role"` // "father" | "assignee"
}

// UpdateTokenRequest は PATCH /rooms/{roomId}/token のリクエストボディ。
type UpdateTokenRequest struct {
	Role        string `json:"role"`
	DeviceToken string `json:"deviceToken"`
}

// RoomResponse は POST /rooms のレスポンス。
type RoomResponse struct {
	RoomID string `json:"roomId"`
}

// JoinRoomResponse は POST /rooms/{roomId}/join のレスポンス。
type JoinRoomResponse struct {
	RoomID string `json:"roomId"`
	Role   string `json:"role"`
}
