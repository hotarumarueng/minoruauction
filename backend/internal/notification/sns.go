// Package notification は SNS を使ったプッシュ通知の実装を提供する。
// task.Notifier インターフェースを満たし、cmd/task-handler から依存注入される。
package notification

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sns"
)

// SNSNotifier は Amazon SNS を通じてプッシュ通知を発行する。
// デバイストークンから Platform Endpoint を取得し、Publish する。
type SNSNotifier struct {
	client            *sns.Client
	fcmPlatformAppARN string
}

// NewSNSNotifier は環境変数 SNS_FCM_PLATFORM_APP_ARN から設定を読み込む。
func NewSNSNotifier(client *sns.Client) *SNSNotifier {
	return &SNSNotifier{
		client:            client,
		fcmPlatformAppARN: os.Getenv("SNS_FCM_PLATFORM_APP_ARN"),
	}
}

// Notify はデバイストークンに対してプッシュ通知を発行する。
// role は "father" または "assignee"。
func (n *SNSNotifier) Notify(ctx context.Context, role, deviceToken, roomID, taskID string) error {
	if n.fcmPlatformAppARN == "" {
		return fmt.Errorf("SNS_FCM_PLATFORM_APP_ARN is not set")
	}

	// Platform Endpoint を取得または作成する
	out, err := n.client.CreatePlatformEndpoint(ctx, &sns.CreatePlatformEndpointInput{
		PlatformApplicationArn: aws.String(n.fcmPlatformAppARN),
		Token:                  aws.String(deviceToken),
	})
	if err != nil {
		return fmt.Errorf("create platform endpoint: %w", err)
	}

	msg, err := buildMessage(roomID, taskID)
	if err != nil {
		return fmt.Errorf("build message: %w", err)
	}

	_, err = n.client.Publish(ctx, &sns.PublishInput{
		TargetArn:        out.EndpointArn,
		Message:          aws.String(msg),
		MessageStructure: aws.String("json"),
	})
	if err != nil {
		return fmt.Errorf("sns publish: %w", err)
	}
	return nil
}

// buildMessage は SNS MessageStructure=json 形式のメッセージを生成する。
// FCM v1 HTTP API 形式に準拠する。
func buildMessage(roomID, taskID string) (string, error) {
	payload := map[string]interface{}{
		"GCM": map[string]interface{}{
			"notification": map[string]string{
				"title": "入札代行アプリ",
				"body":  "ステータスが更新されました",
			},
			"data": map[string]string{
				"roomId": roomID,
				"taskId": taskID,
			},
		},
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
