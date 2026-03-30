package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/toriumihotaru/minoru/internal/db"
	"github.com/toriumihotaru/minoru/internal/notification"
	"github.com/toriumihotaru/minoru/internal/room"
	"github.com/toriumihotaru/minoru/internal/task"
)

var h *task.Handler

func init() {
	// CloudWatch Logs で検索・フィルタリングできるよう JSON 形式で出力する
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	ctx := context.Background()
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		panic("failed to load AWS config: " + err.Error())
	}

	ddb := db.NewDynamoDBClient(ctx)
	snsClient := sns.NewFromConfig(cfg)
	notifier := notification.NewSNSNotifier(snsClient)

	roomStore := room.NewDynamoStore(ddb)
	taskStore := task.NewDynamoStore(ddb)
	h = task.NewHandler(roomStore, taskStore, task.DefaultGenerateID, task.WithNotifier(notifier))
}

func main() {
	lambda.Start(h.Handle)
}
