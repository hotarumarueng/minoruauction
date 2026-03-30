package task

import "errors"

var (
	// ErrTaskNotFound はタスクが存在しない場合に返すエラー。
	ErrTaskNotFound = errors.New("task not found")
	// ErrRoomNotFound はルームが存在しない場合に返すエラー。
	ErrRoomNotFound = errors.New("room not found")
)
