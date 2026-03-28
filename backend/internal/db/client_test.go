package db_test

import (
	"context"
	"testing"

	"github.com/toriumihotaru/minoru/internal/db"
)

func TestNewDynamoDBClient_ReturnsNonNil(t *testing.T) {
	// 実際の AWS 接続は不要。設定オブジェクトが生成されることだけ確認する。
	client := db.NewDynamoDBClient(context.Background())
	if client == nil {
		t.Fatal("NewDynamoDBClient() returned nil")
	}
}

func TestNewDynamoDBClient_Idempotent(t *testing.T) {
	// 複数回呼んでも panic しないことを確認
	ctx := context.Background()
	c1 := db.NewDynamoDBClient(ctx)
	c2 := db.NewDynamoDBClient(ctx)
	if c1 == nil || c2 == nil {
		t.Fatal("NewDynamoDBClient() returned nil")
	}
}
