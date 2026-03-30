package task

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/toriumihotaru/minoru/internal/response"
	"github.com/toriumihotaru/minoru/internal/room"
)

// Notifier はプッシュ通知を発行するインターフェース。
// SNS Publish 失敗は呼び出し元でログ記録のみとし、タスク更新の成否に影響させない。
type Notifier interface {
	Notify(ctx context.Context, role, deviceToken, roomID, taskID string) error
}

// HandlerOption は Handler の追加設定を行う関数型オプション。
type HandlerOption func(*Handler)

// WithNotifier は Notifier を Handler に設定する。
func WithNotifier(n Notifier) HandlerOption {
	return func(h *Handler) {
		h.notifier = n
	}
}

// Handler は TaskHandler のリクエストルーティングとビジネスロジックを担う。
type Handler struct {
	roomStore  room.Store
	taskStore  Store
	generateID func() string
	notifier   Notifier // nil の場合は通知をスキップ
}

// NewHandler は Handler を生成する。generateID はタスク ID 生成関数（テストで差し替え可能）。
func NewHandler(roomStore room.Store, taskStore Store, generateID func() string, opts ...HandlerOption) *Handler {
	h := &Handler{
		roomStore:  roomStore,
		taskStore:  taskStore,
		generateID: generateID,
	}
	for _, opt := range opts {
		opt(h)
	}
	return h
}

// DefaultGenerateID は時系列ソート可能なタスク ID を生成する（timestamp ms + random bytes）。
func DefaultGenerateID() string {
	b := make([]byte, 10)
	rand.Read(b) //nolint:errcheck
	return fmt.Sprintf("%013X%X", time.Now().UnixMilli(), b)
}

// Handle は API Gateway のリクエストをルーティングして各ハンドラーに委譲する。
func (h *Handler) Handle(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	path := req.Path
	switch {
	case req.HTTPMethod == "GET" && strings.HasSuffix(path, "/tasks"):
		return h.listTasks(ctx, req)
	case req.HTTPMethod == "POST" && strings.HasSuffix(path, "/tasks"):
		return h.createTask(ctx, req)
	case req.HTTPMethod == "PATCH" && strings.HasSuffix(path, "/amount"):
		return h.updateAmount(ctx, req)
	case req.HTTPMethod == "PATCH" && strings.Contains(path, "/tasks/"):
		return h.updateStatus(ctx, req)
	case req.HTTPMethod == "DELETE" && strings.Contains(path, "/tasks/"):
		return h.deleteTask(ctx, req)
	default:
		return response.ToAPIGatewayErrorResponse(404, "notFound", "エンドポイントが見つかりません"), nil
	}
}

func (h *Handler) listTasks(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	roomID := req.PathParameters["roomId"]

	if _, err := h.roomStore.GetRoom(ctx, roomID); err != nil {
		return response.ToAPIGatewayErrorResponse(404, "roomNotFound", "ルームが見つかりません"), nil
	}

	tasks, err := h.taskStore.ListTasks(ctx, roomID)
	if err != nil {
		return response.ToAPIGatewayErrorResponse(500, "internalError", "内部エラーが発生しました"), nil
	}

	return response.ToAPIGatewayResponse(200, TaskListResponse{Tasks: tasks}), nil
}

func (h *Handler) createTask(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	roomID := req.PathParameters["roomId"]

	r, err := h.roomStore.GetRoom(ctx, roomID)
	if err != nil {
		return response.ToAPIGatewayErrorResponse(404, "roomNotFound", "ルームが見つかりません"), nil
	}

	var body CreateTaskRequest
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return response.ToAPIGatewayErrorResponse(400, "badRequest", "リクエストが不正です"), nil
	}
	if body.AuctionURL == "" || body.RequestedAmount <= 0 {
		return response.ToAPIGatewayErrorResponse(400, "badRequest", "auctionUrl と requestedAmount（1以上）は必須です"), nil
	}

	now := time.Now().UTC().Format(time.RFC3339)
	t := &Task{
		RoomID:          roomID,
		TaskID:          h.generateID(),
		AuctionURL:      body.AuctionURL,
		RequestedAmount: body.RequestedAmount,
		Status:          StatusUnbid,
		StatusHistory:   []StatusEntry{},
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := h.taskStore.CreateTask(ctx, t); err != nil {
		slog.ErrorContext(ctx, "createTask: dynamo error", slog.String("roomId", roomID), slog.String("error", err.Error()))
		return response.ToAPIGatewayErrorResponse(500, "internalError", "内部エラーが発生しました"), nil
	}

	slog.InfoContext(ctx, "task created", slog.String("roomId", roomID), slog.String("taskId", t.TaskID))
	// タスク作成後に担当者へ通知（失敗してもリクエストは成功扱い）
	h.tryNotify(ctx, r, "assignee", roomID, t.TaskID)

	return response.ToAPIGatewayResponse(201, t), nil
}

func (h *Handler) updateStatus(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	roomID := req.PathParameters["roomId"]
	taskID := taskIDFromPath(req.Path)

	var body UpdateTaskStatusRequest
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return response.ToAPIGatewayErrorResponse(400, "badRequest", "リクエストが不正です"), nil
	}

	t, err := h.taskStore.GetTask(ctx, roomID, taskID)
	if err != nil {
		return response.ToAPIGatewayErrorResponse(404, "taskNotFound", "タスクが見つかりません"), nil
	}

	if !IsValidTransition(t.Status, body.Status) {
		return response.ToAPIGatewayErrorResponse(422, "invalidTransition", "このステータスには変更できません"), nil
	}

	now := time.Now().UTC().Format(time.RFC3339)
	entry := StatusEntry{Status: body.Status, Timestamp: now}
	if body.BidAmount != nil {
		entry.Amount = body.BidAmount
	}

	t.Status = body.Status
	t.BidAmount = body.BidAmount
	t.StatusHistory = append(t.StatusHistory, entry)
	t.UpdatedAt = now

	if err := h.taskStore.UpdateTask(ctx, t); err != nil {
		slog.ErrorContext(ctx, "updateStatus: dynamo error", slog.String("roomId", roomID), slog.String("taskId", taskID), slog.String("error", err.Error()))
		return response.ToAPIGatewayErrorResponse(500, "internalError", "内部エラーが発生しました"), nil
	}

	slog.InfoContext(ctx, "task status updated",
		slog.String("roomId", roomID),
		slog.String("taskId", taskID),
		slog.String("status", string(body.Status)),
	)
	// 要再入札・落札のとき父へ通知（失敗してもリクエストは成功扱い）
	if body.Status == StatusRebid || body.Status == StatusWon {
		if r, err := h.roomStore.GetRoom(ctx, roomID); err == nil {
			h.tryNotify(ctx, r, "father", roomID, taskID)
		}
	}

	return response.ToAPIGatewayResponse(200, t), nil
}

func (h *Handler) updateAmount(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	roomID := req.PathParameters["roomId"]
	taskID := taskIDFromPath(req.Path)

	var body UpdateTaskAmountRequest
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return response.ToAPIGatewayErrorResponse(400, "badRequest", "リクエストが不正です"), nil
	}
	if body.RequestedAmount <= 0 {
		return response.ToAPIGatewayErrorResponse(400, "badRequest", "requestedAmount は1以上が必要です"), nil
	}

	t, err := h.taskStore.GetTask(ctx, roomID, taskID)
	if err != nil {
		return response.ToAPIGatewayErrorResponse(404, "taskNotFound", "タスクが見つかりません"), nil
	}

	now := time.Now().UTC().Format(time.RFC3339)
	t.StatusHistory = append(t.StatusHistory, StatusEntry{
		Status:    StatusUnbid,
		Amount:    &body.RequestedAmount,
		Timestamp: now,
	})
	t.RequestedAmount = body.RequestedAmount
	t.Status = StatusUnbid
	t.UpdatedAt = now

	if err := h.taskStore.UpdateTask(ctx, t); err != nil {
		slog.ErrorContext(ctx, "updateAmount: dynamo error", slog.String("roomId", roomID), slog.String("taskId", taskID), slog.String("error", err.Error()))
		return response.ToAPIGatewayErrorResponse(500, "internalError", "内部エラーが発生しました"), nil
	}

	slog.InfoContext(ctx, "task amount updated",
		slog.String("roomId", roomID),
		slog.String("taskId", taskID),
		slog.Int64("requestedAmount", body.RequestedAmount),
	)
	return response.ToAPIGatewayResponse(200, t), nil
}

func (h *Handler) deleteTask(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	roomID := req.PathParameters["roomId"]
	taskID := taskIDFromPath(req.Path)

	err := h.taskStore.DeleteTask(ctx, roomID, taskID)
	if err != nil {
		return response.ToAPIGatewayErrorResponse(404, "taskNotFound", "タスクが見つかりません"), nil
	}
	return response.ToAPIGatewayResponse(204, nil), nil
}

// taskIDFromPath は /rooms/{roomId}/tasks/{taskId}[/...] 形式のパスから taskId を取り出す。
func taskIDFromPath(path string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	// parts: ["rooms", roomId, "tasks", taskId, ...]
	if len(parts) >= 4 {
		return parts[3]
	}
	return ""
}

// tryNotify は通知を試み、失敗した場合はログ記録のみ行う。
func (h *Handler) tryNotify(ctx context.Context, r *room.Room, role, roomID, taskID string) {
	if h.notifier == nil {
		return
	}
	token, ok := r.MemberTokens[role]
	if !ok || token == "" {
		return
	}
	if err := h.notifier.Notify(ctx, role, token, roomID, taskID); err != nil {
		slog.WarnContext(ctx, "notification failed",
			slog.String("role", role),
			slog.String("roomId", roomID),
			slog.String("taskId", taskID),
			slog.String("error", err.Error()),
		)
	}
}
