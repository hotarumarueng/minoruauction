package task_test

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/aws/aws-lambda-go/events"
	"github.com/toriumihotaru/minoru/internal/room"
	"github.com/toriumihotaru/minoru/internal/task"
)

// ─── Mock notifier ────────────────────────────────────────────

type notifyCall struct {
	role        string
	deviceToken string
	roomID      string
	taskID      string
}

type mockNotifier struct {
	calls []notifyCall
	err   error
}

func (m *mockNotifier) Notify(_ context.Context, role, deviceToken, roomID, taskID string) error {
	m.calls = append(m.calls, notifyCall{role, deviceToken, roomID, taskID})
	return m.err
}

// ─── Mock stores ──────────────────────────────────────────────

type mockRoomStore struct {
	rooms map[string]*room.Room
}

func (m *mockRoomStore) CreateRoom(_ context.Context, r *room.Room) error { return nil }
func (m *mockRoomStore) GetRoom(_ context.Context, roomID string) (*room.Room, error) {
	r, ok := m.rooms[roomID]
	if !ok {
		return nil, room.ErrRoomNotFound
	}
	return r, nil
}
func (m *mockRoomStore) UpdateMemberToken(_ context.Context, _, _, _ string) error { return nil }

type mockTaskStore struct {
	tasks map[string]*task.Task
}

func newMockTaskStore() *mockTaskStore {
	return &mockTaskStore{tasks: make(map[string]*task.Task)}
}
func (m *mockTaskStore) ListTasks(_ context.Context, roomID string) ([]task.Task, error) {
	var result []task.Task
	for _, t := range m.tasks {
		if t.RoomID == roomID {
			result = append(result, *t)
		}
	}
	if result == nil {
		result = []task.Task{}
	}
	return result, nil
}
func (m *mockTaskStore) CreateTask(_ context.Context, t *task.Task) error {
	m.tasks[t.TaskID] = t
	return nil
}
func (m *mockTaskStore) GetTask(_ context.Context, roomID, taskID string) (*task.Task, error) {
	t, ok := m.tasks[taskID]
	if !ok || t.RoomID != roomID {
		return nil, task.ErrTaskNotFound
	}
	return t, nil
}
func (m *mockTaskStore) UpdateTask(_ context.Context, t *task.Task) error {
	m.tasks[t.TaskID] = t
	return nil
}
func (m *mockTaskStore) DeleteTask(_ context.Context, roomID, taskID string) error {
	t, ok := m.tasks[taskID]
	if !ok || t.RoomID != roomID {
		return task.ErrTaskNotFound
	}
	delete(m.tasks, taskID)
	return nil
}

// ─── Helpers ──────────────────────────────────────────────────

func roomStoreWith(roomID string) *mockRoomStore {
	return &mockRoomStore{
		rooms: map[string]*room.Room{
			roomID: {RoomID: roomID, MemberTokens: map[string]string{}},
		},
	}
}

func roomStoreWithTokens(roomID string, tokens map[string]string) *mockRoomStore {
	return &mockRoomStore{
		rooms: map[string]*room.Room{
			roomID: {RoomID: roomID, MemberTokens: tokens},
		},
	}
}

func emptyRoomStore() *mockRoomStore {
	return &mockRoomStore{rooms: map[string]*room.Room{}}
}

func makeTestTask(roomID, taskID string, status task.TaskStatus) *task.Task {
	return &task.Task{
		RoomID:          roomID,
		TaskID:          taskID,
		AuctionURL:      "https://auctions.yahoo.co.jp/item/x1234",
		RequestedAmount: 1000,
		Status:          status,
		StatusHistory:   []task.StatusEntry{},
	}
}

// ─── 3.1: GET /rooms/{roomId}/tasks ───────────────────────────

func TestHandler_ListTasks_Empty(t *testing.T) {
	h := task.NewHandler(roomStoreWith("R01"), newMockTaskStore(), func() string { return "T01" })
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "GET",
		Resource:       "/rooms/{roomId}/tasks",
		PathParameters: map[string]string{"roomId": "R01"},
	}
	resp, err := h.Handle(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	var body task.TaskListResponse
	json.Unmarshal([]byte(resp.Body), &body)
	if len(body.Tasks) != 0 {
		t.Errorf("tasks count = %d, want 0", len(body.Tasks))
	}
}

func TestHandler_ListTasks_RoomNotFound(t *testing.T) {
	h := task.NewHandler(emptyRoomStore(), newMockTaskStore(), func() string { return "T01" })
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "GET",
		Resource:       "/rooms/{roomId}/tasks",
		PathParameters: map[string]string{"roomId": "NOTEX"},
	}
	resp, _ := h.Handle(context.Background(), req)
	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

// ─── 3.1: POST /rooms/{roomId}/tasks ──────────────────────────

func TestHandler_CreateTask_Returns201(t *testing.T) {
	h := task.NewHandler(roomStoreWith("R01"), newMockTaskStore(), func() string { return "T01" })
	body, _ := json.Marshal(task.CreateTaskRequest{AuctionURL: "https://auctions.yahoo.co.jp/item/x1234", RequestedAmount: 1000})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "POST",
		Resource:       "/rooms/{roomId}/tasks",
		PathParameters: map[string]string{"roomId": "R01"},
		Body:           string(body),
	}
	resp, err := h.Handle(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 201 {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}
}

func TestHandler_CreateTask_StatusIsUnbid(t *testing.T) {
	ts := newMockTaskStore()
	h := task.NewHandler(roomStoreWith("R01"), ts, func() string { return "T01" })
	body, _ := json.Marshal(task.CreateTaskRequest{AuctionURL: "https://auctions.yahoo.co.jp/item/x1234", RequestedAmount: 1000})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "POST",
		Resource:       "/rooms/{roomId}/tasks",
		PathParameters: map[string]string{"roomId": "R01"},
		Body:           string(body),
	}
	h.Handle(context.Background(), req)
	created := ts.tasks["T01"]
	if created == nil {
		t.Fatal("task should be stored")
	}
	if created.Status != task.StatusUnbid {
		t.Errorf("status = %q, want %q", created.Status, task.StatusUnbid)
	}
}

func TestHandler_CreateTask_RoomNotFound(t *testing.T) {
	h := task.NewHandler(emptyRoomStore(), newMockTaskStore(), func() string { return "T01" })
	body, _ := json.Marshal(task.CreateTaskRequest{AuctionURL: "https://auctions.yahoo.co.jp/item/x1234", RequestedAmount: 1000})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "POST",
		Resource:       "/rooms/{roomId}/tasks",
		PathParameters: map[string]string{"roomId": "NOTEX"},
		Body:           string(body),
	}
	resp, _ := h.Handle(context.Background(), req)
	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

func TestHandler_CreateTask_BadRequest_MissingURL(t *testing.T) {
	h := task.NewHandler(roomStoreWith("R01"), newMockTaskStore(), func() string { return "T01" })
	body, _ := json.Marshal(map[string]interface{}{"requestedAmount": 1000})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "POST",
		Resource:       "/rooms/{roomId}/tasks",
		PathParameters: map[string]string{"roomId": "R01"},
		Body:           string(body),
	}
	resp, _ := h.Handle(context.Background(), req)
	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

func TestHandler_CreateTask_BadRequest_ZeroAmount(t *testing.T) {
	h := task.NewHandler(roomStoreWith("R01"), newMockTaskStore(), func() string { return "T01" })
	body, _ := json.Marshal(task.CreateTaskRequest{AuctionURL: "https://auctions.yahoo.co.jp/item/x1234", RequestedAmount: 0})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "POST",
		Resource:       "/rooms/{roomId}/tasks",
		PathParameters: map[string]string{"roomId": "R01"},
		Body:           string(body),
	}
	resp, _ := h.Handle(context.Background(), req)
	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

// ─── 3.2: PATCH /rooms/{roomId}/tasks/{taskId} ────────────────

func TestHandler_UpdateStatus_ValidTransition(t *testing.T) {
	ts := newMockTaskStore()
	ts.tasks["T01"] = makeTestTask("R01", "T01", task.StatusUnbid)
	h := task.NewHandler(roomStoreWith("R01"), ts, func() string { return "NEW" })

	body, _ := json.Marshal(task.UpdateTaskStatusRequest{Status: task.StatusBid})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "PATCH",
		Resource:       "/rooms/{roomId}/tasks/{taskId}",
		PathParameters: map[string]string{"roomId": "R01", "taskId": "T01"},
		Body:           string(body),
	}
	resp, err := h.Handle(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	if ts.tasks["T01"].Status != task.StatusBid {
		t.Errorf("task status = %q, want %q", ts.tasks["T01"].Status, task.StatusBid)
	}
}

func TestHandler_UpdateStatus_InvalidTransition_Returns422(t *testing.T) {
	ts := newMockTaskStore()
	ts.tasks["T01"] = makeTestTask("R01", "T01", task.StatusWon)
	h := task.NewHandler(roomStoreWith("R01"), ts, func() string { return "NEW" })

	body, _ := json.Marshal(task.UpdateTaskStatusRequest{Status: task.StatusBid})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "PATCH",
		Resource:       "/rooms/{roomId}/tasks/{taskId}",
		PathParameters: map[string]string{"roomId": "R01", "taskId": "T01"},
		Body:           string(body),
	}
	resp, _ := h.Handle(context.Background(), req)
	if resp.StatusCode != 422 {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
}

func TestHandler_UpdateStatus_TaskNotFound(t *testing.T) {
	h := task.NewHandler(roomStoreWith("R01"), newMockTaskStore(), func() string { return "NEW" })
	body, _ := json.Marshal(task.UpdateTaskStatusRequest{Status: task.StatusBid})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "PATCH",
		Resource:       "/rooms/{roomId}/tasks/{taskId}",
		PathParameters: map[string]string{"roomId": "R01", "taskId": "NOTEX"},
		Body:           string(body),
	}
	resp, _ := h.Handle(context.Background(), req)
	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

func TestHandler_UpdateStatus_HistoryAppended(t *testing.T) {
	ts := newMockTaskStore()
	ts.tasks["T01"] = makeTestTask("R01", "T01", task.StatusUnbid)
	h := task.NewHandler(roomStoreWith("R01"), ts, func() string { return "NEW" })

	body, _ := json.Marshal(task.UpdateTaskStatusRequest{Status: task.StatusBid})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "PATCH",
		Resource:       "/rooms/{roomId}/tasks/{taskId}",
		PathParameters: map[string]string{"roomId": "R01", "taskId": "T01"},
		Body:           string(body),
	}
	h.Handle(context.Background(), req)
	if len(ts.tasks["T01"].StatusHistory) != 1 {
		t.Errorf("statusHistory len = %d, want 1", len(ts.tasks["T01"].StatusHistory))
	}
	if ts.tasks["T01"].StatusHistory[0].Status != task.StatusBid {
		t.Errorf("history[0].status = %q, want %q", ts.tasks["T01"].StatusHistory[0].Status, task.StatusBid)
	}
}

// ─── 3.3: PATCH /rooms/{roomId}/tasks/{taskId}/amount ─────────

func TestHandler_UpdateAmount_ResetToUnbid(t *testing.T) {
	ts := newMockTaskStore()
	ts.tasks["T01"] = makeTestTask("R01", "T01", task.StatusBid)
	h := task.NewHandler(roomStoreWith("R01"), ts, func() string { return "NEW" })

	body, _ := json.Marshal(task.UpdateTaskAmountRequest{RequestedAmount: 2000})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "PATCH",
		Resource:       "/rooms/{roomId}/tasks/{taskId}/amount",
		PathParameters: map[string]string{"roomId": "R01", "taskId": "T01"},
		Body:           string(body),
	}
	resp, err := h.Handle(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	if ts.tasks["T01"].Status != task.StatusUnbid {
		t.Errorf("status = %q, want 未入札 after amount update", ts.tasks["T01"].Status)
	}
	if ts.tasks["T01"].RequestedAmount != 2000 {
		t.Errorf("requestedAmount = %d, want 2000", ts.tasks["T01"].RequestedAmount)
	}
}

func TestHandler_UpdateAmount_HistoryAppended(t *testing.T) {
	ts := newMockTaskStore()
	ts.tasks["T01"] = makeTestTask("R01", "T01", task.StatusBid)
	h := task.NewHandler(roomStoreWith("R01"), ts, func() string { return "NEW" })

	body, _ := json.Marshal(task.UpdateTaskAmountRequest{RequestedAmount: 2000})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "PATCH",
		Resource:       "/rooms/{roomId}/tasks/{taskId}/amount",
		PathParameters: map[string]string{"roomId": "R01", "taskId": "T01"},
		Body:           string(body),
	}
	h.Handle(context.Background(), req)
	if len(ts.tasks["T01"].StatusHistory) != 1 {
		t.Errorf("statusHistory len = %d, want 1", len(ts.tasks["T01"].StatusHistory))
	}
}

func TestHandler_UpdateAmount_TaskNotFound(t *testing.T) {
	h := task.NewHandler(roomStoreWith("R01"), newMockTaskStore(), func() string { return "NEW" })
	body, _ := json.Marshal(task.UpdateTaskAmountRequest{RequestedAmount: 2000})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "PATCH",
		Resource:       "/rooms/{roomId}/tasks/{taskId}/amount",
		PathParameters: map[string]string{"roomId": "R01", "taskId": "NOTEX"},
		Body:           string(body),
	}
	resp, _ := h.Handle(context.Background(), req)
	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

// ─── 4.2: プッシュ通知 ─────────────────────────────────────────

func TestHandler_CreateTask_NotifiesAssignee(t *testing.T) {
	ts := newMockTaskStore()
	notifier := &mockNotifier{}
	h := task.NewHandler(
		roomStoreWithTokens("R01", map[string]string{"assignee": "token-assignee", "father": "token-father"}),
		ts,
		func() string { return "T01" },
		task.WithNotifier(notifier),
	)
	body, _ := json.Marshal(task.CreateTaskRequest{AuctionURL: "https://auctions.yahoo.co.jp/item/x1234", RequestedAmount: 1000})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "POST",
		Resource:       "/rooms/{roomId}/tasks",
		PathParameters: map[string]string{"roomId": "R01"},
		Body:           string(body),
	}
	h.Handle(context.Background(), req)
	if len(notifier.calls) != 1 {
		t.Fatalf("notify calls = %d, want 1", len(notifier.calls))
	}
	if notifier.calls[0].role != "assignee" {
		t.Errorf("notified role = %q, want assignee", notifier.calls[0].role)
	}
	if notifier.calls[0].deviceToken != "token-assignee" {
		t.Errorf("notified token = %q, want token-assignee", notifier.calls[0].deviceToken)
	}
}

func TestHandler_UpdateStatus_Rebid_NotifiesFather(t *testing.T) {
	ts := newMockTaskStore()
	ts.tasks["T01"] = makeTestTask("R01", "T01", task.StatusBid)
	notifier := &mockNotifier{}
	h := task.NewHandler(
		roomStoreWithTokens("R01", map[string]string{"father": "token-father", "assignee": "token-assignee"}),
		ts,
		func() string { return "NEW" },
		task.WithNotifier(notifier),
	)
	body, _ := json.Marshal(task.UpdateTaskStatusRequest{Status: task.StatusRebid})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "PATCH",
		Resource:       "/rooms/{roomId}/tasks/{taskId}",
		PathParameters: map[string]string{"roomId": "R01", "taskId": "T01"},
		Body:           string(body),
	}
	h.Handle(context.Background(), req)
	if len(notifier.calls) != 1 {
		t.Fatalf("notify calls = %d, want 1", len(notifier.calls))
	}
	if notifier.calls[0].role != "father" {
		t.Errorf("notified role = %q, want father", notifier.calls[0].role)
	}
}

func TestHandler_UpdateStatus_Won_NotifiesFather(t *testing.T) {
	ts := newMockTaskStore()
	ts.tasks["T01"] = makeTestTask("R01", "T01", task.StatusBid)
	notifier := &mockNotifier{}
	h := task.NewHandler(
		roomStoreWithTokens("R01", map[string]string{"father": "token-father"}),
		ts,
		func() string { return "NEW" },
		task.WithNotifier(notifier),
	)
	body, _ := json.Marshal(task.UpdateTaskStatusRequest{Status: task.StatusWon})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "PATCH",
		Resource:       "/rooms/{roomId}/tasks/{taskId}",
		PathParameters: map[string]string{"roomId": "R01", "taskId": "T01"},
		Body:           string(body),
	}
	h.Handle(context.Background(), req)
	if len(notifier.calls) != 1 || notifier.calls[0].role != "father" {
		t.Errorf("expected father notification on 落札")
	}
}

func TestHandler_UpdateStatus_Bid_DoesNotNotify(t *testing.T) {
	ts := newMockTaskStore()
	ts.tasks["T01"] = makeTestTask("R01", "T01", task.StatusUnbid)
	notifier := &mockNotifier{}
	h := task.NewHandler(
		roomStoreWithTokens("R01", map[string]string{"father": "token-father"}),
		ts,
		func() string { return "NEW" },
		task.WithNotifier(notifier),
	)
	body, _ := json.Marshal(task.UpdateTaskStatusRequest{Status: task.StatusBid})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "PATCH",
		Resource:       "/rooms/{roomId}/tasks/{taskId}",
		PathParameters: map[string]string{"roomId": "R01", "taskId": "T01"},
		Body:           string(body),
	}
	h.Handle(context.Background(), req)
	if len(notifier.calls) != 0 {
		t.Errorf("notify calls = %d, want 0 for 入札済み status", len(notifier.calls))
	}
}

func TestHandler_NotifyFailure_DoesNotFailRequest(t *testing.T) {
	ts := newMockTaskStore()
	notifier := &mockNotifier{err: fmt.Errorf("SNS error")}
	h := task.NewHandler(
		roomStoreWithTokens("R01", map[string]string{"assignee": "token-assignee"}),
		ts,
		func() string { return "T01" },
		task.WithNotifier(notifier),
	)
	body, _ := json.Marshal(task.CreateTaskRequest{AuctionURL: "https://auctions.yahoo.co.jp/item/x1234", RequestedAmount: 1000})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "POST",
		Resource:       "/rooms/{roomId}/tasks",
		PathParameters: map[string]string{"roomId": "R01"},
		Body:           string(body),
	}
	resp, err := h.Handle(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 201 {
		t.Errorf("status = %d, want 201 even when notifier fails", resp.StatusCode)
	}
}

// ─── DELETE /rooms/{roomId}/tasks/{taskId} ────────────────────

func TestDeleteTask(t *testing.T) {
	t.Run("存在するタスクを削除すると204を返す", func(t *testing.T) {
		roomStore := &mockRoomStore{rooms: map[string]*room.Room{"ABC123": {RoomID: "ABC123"}}}
		taskStore := newMockTaskStore()
		existing := &task.Task{RoomID: "ABC123", TaskID: "task-01", Status: "未入札", StatusHistory: []task.StatusEntry{}}
		taskStore.tasks["task-01"] = existing

		h := task.NewHandler(roomStore, taskStore, func() string { return "task-02" })
		req := events.APIGatewayProxyRequest{
			HTTPMethod:     "DELETE",
			Path:           "/rooms/ABC123/tasks/task-01",
			PathParameters: map[string]string{"roomId": "ABC123", "taskId": "task-01"},
		}
		resp, err := h.Handle(context.Background(), req)

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != 204 {
			t.Errorf("expected 204, got %d: %s", resp.StatusCode, resp.Body)
		}
		// DynamoDB から削除されていること
		_, getErr := taskStore.GetTask(context.Background(), "ABC123", "task-01")
		if getErr == nil {
			t.Error("task should have been deleted")
		}
	})

	t.Run("存在しないタスクを削除すると404を返す", func(t *testing.T) {
		roomStore := &mockRoomStore{rooms: map[string]*room.Room{"ABC123": {RoomID: "ABC123"}}}
		taskStore := newMockTaskStore()

		h := task.NewHandler(roomStore, taskStore, func() string { return "task-01" })
		req := events.APIGatewayProxyRequest{
			HTTPMethod:     "DELETE",
			Path:           "/rooms/ABC123/tasks/nonexistent",
			PathParameters: map[string]string{"roomId": "ABC123", "taskId": "nonexistent"},
		}
		resp, err := h.Handle(context.Background(), req)

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.StatusCode != 404 {
			t.Errorf("expected 404, got %d", resp.StatusCode)
		}
	})
}
