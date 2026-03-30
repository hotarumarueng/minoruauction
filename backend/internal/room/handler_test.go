package room_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/aws/aws-lambda-go/events"
	"github.com/toriumihotaru/minoru/internal/room"
)

// mockStore は room.Store を実装するテスト用モック
type mockStore struct {
	rooms map[string]*room.Room
	err   error
}

func newMockStore() *mockStore {
	return &mockStore{rooms: make(map[string]*room.Room)}
}

func (m *mockStore) CreateRoom(_ context.Context, r *room.Room) error {
	if m.err != nil {
		return m.err
	}
	m.rooms[r.RoomID] = r
	return nil
}

func (m *mockStore) GetRoom(_ context.Context, roomID string) (*room.Room, error) {
	if m.err != nil {
		return nil, m.err
	}
	r, ok := m.rooms[roomID]
	if !ok {
		return nil, room.ErrRoomNotFound
	}
	return r, nil
}

func (m *mockStore) UpdateMemberToken(_ context.Context, roomID, role, deviceToken string) error {
	if m.err != nil {
		return m.err
	}
	r, ok := m.rooms[roomID]
	if !ok {
		return room.ErrRoomNotFound
	}
	if r.MemberTokens == nil {
		r.MemberTokens = make(map[string]string)
	}
	r.MemberTokens[role] = deviceToken
	return nil
}

// ─── 2.1: POST /rooms ─────────────────────────────────────────

func TestHandler_CreateRoom_Returns201(t *testing.T) {
	h := room.NewHandler(newMockStore())
	req := events.APIGatewayProxyRequest{HTTPMethod: "POST", Resource: "/rooms"}

	resp, err := h.Handle(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 201 {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}
}

func TestHandler_CreateRoom_RoomIDIs6CharAlphanumeric(t *testing.T) {
	h := room.NewHandler(newMockStore())
	req := events.APIGatewayProxyRequest{HTTPMethod: "POST", Resource: "/rooms"}

	resp, _ := h.Handle(context.Background(), req)

	var body map[string]string
	if err := json.Unmarshal([]byte(resp.Body), &body); err != nil {
		t.Fatal(err)
	}
	roomID := body["roomId"]
	if len(roomID) != 6 {
		t.Errorf("roomId length = %d, want 6", len(roomID))
	}
	for _, c := range roomID {
		if !('A' <= c && c <= 'Z') && !('0' <= c && c <= '9') {
			t.Errorf("roomId contains non-alphanumeric char: %c", c)
		}
	}
}

func TestHandler_CreateRoom_StoredInDB(t *testing.T) {
	store := newMockStore()
	h := room.NewHandler(store)
	req := events.APIGatewayProxyRequest{HTTPMethod: "POST", Resource: "/rooms"}

	resp, _ := h.Handle(context.Background(), req)

	var body map[string]string
	json.Unmarshal([]byte(resp.Body), &body)
	roomID := body["roomId"]

	if _, exists := store.rooms[roomID]; !exists {
		t.Error("room should be stored in DB after creation")
	}
}

// ─── 2.2: POST /rooms/{roomId}/join ───────────────────────────

func TestHandler_JoinRoom_Success(t *testing.T) {
	store := newMockStore()
	store.rooms["ABC123"] = &room.Room{RoomID: "ABC123", MemberTokens: map[string]string{}}
	h := room.NewHandler(store)

	body, _ := json.Marshal(room.JoinRoomRequest{DeviceToken: "token-abc", Role: "father"})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "POST",
		Resource:       "/rooms/{roomId}/join",
		PathParameters: map[string]string{"roomId": "ABC123"},
		Body:           string(body),
	}

	resp, err := h.Handle(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
}

func TestHandler_JoinRoom_TokenSavedInDB(t *testing.T) {
	store := newMockStore()
	store.rooms["ABC123"] = &room.Room{RoomID: "ABC123", MemberTokens: map[string]string{}}
	h := room.NewHandler(store)

	body, _ := json.Marshal(room.JoinRoomRequest{DeviceToken: "token-father", Role: "father"})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "POST",
		Resource:       "/rooms/{roomId}/join",
		PathParameters: map[string]string{"roomId": "ABC123"},
		Body:           string(body),
	}
	h.Handle(context.Background(), req)

	if store.rooms["ABC123"].MemberTokens["father"] != "token-father" {
		t.Error("deviceToken should be saved to memberTokens")
	}
}

func TestHandler_JoinRoom_NotFound(t *testing.T) {
	h := room.NewHandler(newMockStore())

	body, _ := json.Marshal(room.JoinRoomRequest{DeviceToken: "token-abc", Role: "father"})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "POST",
		Resource:       "/rooms/{roomId}/join",
		PathParameters: map[string]string{"roomId": "NOTEX"},
		Body:           string(body),
	}

	resp, err := h.Handle(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

func TestHandler_JoinRoom_Conflict_WhenRoomFull(t *testing.T) {
	store := newMockStore()
	store.rooms["ABC123"] = &room.Room{
		RoomID:       "ABC123",
		MemberTokens: map[string]string{"father": "token-f", "assignee": "token-a"},
	}
	h := room.NewHandler(store)

	body, _ := json.Marshal(room.JoinRoomRequest{DeviceToken: "token-new", Role: "father"})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "POST",
		Resource:       "/rooms/{roomId}/join",
		PathParameters: map[string]string{"roomId": "ABC123"},
		Body:           string(body),
	}

	resp, err := h.Handle(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 409 {
		t.Errorf("status = %d, want 409", resp.StatusCode)
	}
}

func TestHandler_JoinRoom_BadRequest_MissingRole(t *testing.T) {
	store := newMockStore()
	store.rooms["ABC123"] = &room.Room{RoomID: "ABC123", MemberTokens: map[string]string{}}
	h := room.NewHandler(store)

	body, _ := json.Marshal(map[string]string{"deviceToken": "token-abc"})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "POST",
		Resource:       "/rooms/{roomId}/join",
		PathParameters: map[string]string{"roomId": "ABC123"},
		Body:           string(body),
	}

	resp, _ := h.Handle(context.Background(), req)
	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

// ─── 2.3: PATCH /rooms/{roomId}/token ─────────────────────────

func TestHandler_UpdateToken_Success(t *testing.T) {
	store := newMockStore()
	store.rooms["ABC123"] = &room.Room{RoomID: "ABC123", MemberTokens: map[string]string{"father": "old"}}
	h := room.NewHandler(store)

	body, _ := json.Marshal(room.UpdateTokenRequest{Role: "father", DeviceToken: "new-token"})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "PATCH",
		Resource:       "/rooms/{roomId}/token",
		PathParameters: map[string]string{"roomId": "ABC123"},
		Body:           string(body),
	}

	resp, err := h.Handle(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	if store.rooms["ABC123"].MemberTokens["father"] != "new-token" {
		t.Error("deviceToken should be updated")
	}
}

func TestHandler_UpdateToken_NotFound(t *testing.T) {
	h := room.NewHandler(newMockStore())

	body, _ := json.Marshal(room.UpdateTokenRequest{Role: "father", DeviceToken: "new-token"})
	req := events.APIGatewayProxyRequest{
		HTTPMethod:     "PATCH",
		Resource:       "/rooms/{roomId}/token",
		PathParameters: map[string]string{"roomId": "NOTEX"},
		Body:           string(body),
	}

	resp, err := h.Handle(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

// ─── Unknown route ─────────────────────────────────────────────

func TestHandler_UnknownRoute_Returns404(t *testing.T) {
	h := room.NewHandler(newMockStore())
	req := events.APIGatewayProxyRequest{HTTPMethod: "GET", Resource: "/unknown"}

	resp, _ := h.Handle(context.Background(), req)
	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}
