package room

import (
	"context"
	"errors"
)

// ErrRoomNotFound はルームが存在しない場合に返すエラー。
var ErrRoomNotFound = errors.New("room not found")

// Store は rooms テーブルへのアクセスを抽象化するインターフェース。
// テスト時はモックに差し替えられる。
type Store interface {
	CreateRoom(ctx context.Context, room *Room) error
	GetRoom(ctx context.Context, roomID string) (*Room, error)
	UpdateMemberToken(ctx context.Context, roomID, role, deviceToken string) error
}
