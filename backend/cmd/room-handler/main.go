package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/toriumihotaru/minoru/internal/db"
	"github.com/toriumihotaru/minoru/internal/room"
)

var h *room.Handler

func init() {
	// CloudWatch Logs で検索・フィルタリングできるよう JSON 形式で出力する
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	ddb := db.NewDynamoDBClient(context.Background())
	store := room.NewDynamoStore(ddb)
	h = room.NewHandler(store)
}

func main() {
	lambda.Start(h.Handle)
}
