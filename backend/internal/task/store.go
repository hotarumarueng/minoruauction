package task

import "context"

// Store は tasks テーブルへのアクセスを抽象化するインターフェース。
type Store interface {
	ListTasks(ctx context.Context, roomID string) ([]Task, error)
	CreateTask(ctx context.Context, task *Task) error
	GetTask(ctx context.Context, roomID, taskID string) (*Task, error)
	UpdateTask(ctx context.Context, task *Task) error
	DeleteTask(ctx context.Context, roomID, taskID string) error
}
