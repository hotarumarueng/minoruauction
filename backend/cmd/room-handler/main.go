package main

import (
	"context"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/toriumihotaru/minoru/internal/db"
	"github.com/toriumihotaru/minoru/internal/response"
)

var ddb = db.NewDynamoDBClient(context.Background())

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	_ = ddb // タスク 2.x で実装予定
	return response.ToAPIGatewayErrorResponse(501, "notImplemented", "未実装"), nil
}

func main() {
	lambda.Start(handler)
}
