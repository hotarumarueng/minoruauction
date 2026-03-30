package room

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/toriumihotaru/minoru/internal/response"
)

const roomIDChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

// generateRoomID は 6 文字の大文字英数字ランダム文字列を生成する。
// crypto/rand を使い推測耐性を持たせる。
func generateRoomID() string {
	b := make([]byte, 6)
	rand.Read(b) //nolint:errcheck // crypto/rand の Read は仕様上エラーを返さない
	for i, v := range b {
		b[i] = roomIDChars[int(v)%len(roomIDChars)]
	}
	return string(b)
}

// Handler は RoomHandler のリクエストルーティングとビジネスロジックを担う。
type Handler struct {
	store Store
}

// NewHandler は Handler を生成する。
func NewHandler(store Store) *Handler {
	return &Handler{store: store}
}

// Handle は API Gateway のリクエストをルーティングして各ハンドラーに委譲する。
func (h *Handler) Handle(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	path := req.Path
	switch {
	case req.HTTPMethod == "POST" && path == "/rooms":
		return h.createRoom(ctx, req)
	case req.HTTPMethod == "POST" && strings.HasSuffix(path, "/join"):
		return h.joinRoom(ctx, req)
	case req.HTTPMethod == "PATCH" && strings.HasSuffix(path, "/token"):
		return h.updateToken(ctx, req)
	default:
		return response.ToAPIGatewayErrorResponse(404, "notFound", "エンドポイントが見つかりません"), nil
	}
}

func (h *Handler) createRoom(ctx context.Context, _ events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	roomID := generateRoomID()
	now := time.Now().UTC()
	r := &Room{
		RoomID:       roomID,
		MemberTokens: make(map[string]string),
		CreatedAt:    now.Format(time.RFC3339),
		ExpireAt:     now.Add(7 * 24 * time.Hour).Unix(), // 7日後に自動削除
	}

	if err := h.store.CreateRoom(ctx, r); err != nil {
		slog.ErrorContext(ctx, "createRoom: dynamo error", slog.String("error", err.Error()))
		return response.ToAPIGatewayErrorResponse(500, "internalError", "内部エラーが発生しました"), nil
	}

	slog.InfoContext(ctx, "room created", slog.String("roomId", roomID))
	return response.ToAPIGatewayResponse(201, RoomResponse{RoomID: roomID}), nil
}

func (h *Handler) joinRoom(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	roomID := roomIDFromPath(req.Path)

	var body JoinRoomRequest
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return response.ToAPIGatewayErrorResponse(400, "badRequest", "リクエストが不正です"), nil
	}
	if body.DeviceToken == "" || (body.Role != "father" && body.Role != "assignee") {
		return response.ToAPIGatewayErrorResponse(400, "badRequest", "deviceToken と role（father/assignee）は必須です"), nil
	}

	r, err := h.store.GetRoom(ctx, roomID)
	if err == ErrRoomNotFound {
		return response.ToAPIGatewayErrorResponse(404, "roomNotFound", "ルームが見つかりません"), nil
	}
	if err != nil {
		return response.ToAPIGatewayErrorResponse(500, "internalError", "内部エラーが発生しました"), nil
	}

	// 2名固定：両ロールが埋まっている場合は 409
	if len(r.MemberTokens) >= 2 {
		return response.ToAPIGatewayErrorResponse(409, "roomFull", "このルームは既に2名が参加しています"), nil
	}

	if err := h.store.UpdateMemberToken(ctx, roomID, body.Role, body.DeviceToken); err != nil {
		slog.ErrorContext(ctx, "joinRoom: dynamo error", slog.String("roomId", roomID), slog.String("error", err.Error()))
		return response.ToAPIGatewayErrorResponse(500, "internalError", "内部エラーが発生しました"), nil
	}

	slog.InfoContext(ctx, "room joined", slog.String("roomId", roomID), slog.String("role", body.Role))
	return response.ToAPIGatewayResponse(200, JoinRoomResponse{RoomID: roomID, Role: body.Role}), nil
}

func (h *Handler) updateToken(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	roomID := roomIDFromPath(req.Path)

	var body UpdateTokenRequest
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return response.ToAPIGatewayErrorResponse(400, "badRequest", "リクエストが不正です"), nil
	}
	if body.DeviceToken == "" || (body.Role != "father" && body.Role != "assignee") {
		return response.ToAPIGatewayErrorResponse(400, "badRequest", "role と deviceToken は必須です"), nil
	}

	if err := h.store.UpdateMemberToken(ctx, roomID, body.Role, body.DeviceToken); err != nil {
		if err == ErrRoomNotFound {
			return response.ToAPIGatewayErrorResponse(404, "roomNotFound", "ルームが見つかりません"), nil
		}
		slog.ErrorContext(ctx, "updateToken: dynamo error", slog.String("roomId", roomID), slog.String("error", err.Error()))
		return response.ToAPIGatewayErrorResponse(500, "internalError", "内部エラーが発生しました"), nil
	}

	slog.InfoContext(ctx, "device token updated", slog.String("roomId", roomID), slog.String("role", body.Role))
	return response.ToAPIGatewayResponse(200, map[string]bool{"success": true}), nil
}

// roomIDFromPath は /rooms/{roomId}/... 形式のパスから roomId を取り出す。
func roomIDFromPath(path string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) >= 2 {
		return parts[1]
	}
	return ""
}
