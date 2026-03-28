package db

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

// NewDynamoDBClient は AWS SDK v2 の DynamoDB クライアントを生成する。
// Lambda 実行環境では環境変数（AWS_REGION 等）から自動で設定を読み込む。
func NewDynamoDBClient(ctx context.Context) *dynamodb.Client {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		// 設定読み込み失敗は起動時エラーとして扱う（Lambda init フェーズで検知）
		panic("failed to load AWS config: " + err.Error())
	}
	return dynamodb.NewFromConfig(cfg)
}
