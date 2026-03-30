package task

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// DynamoStore は DynamoDB を使った Store 実装。
type DynamoStore struct {
	client     *dynamodb.Client
	tasksTable string
}

// NewDynamoStore は環境変数 TASKS_TABLE からテーブル名を読み込んで DynamoStore を生成する。
func NewDynamoStore(client *dynamodb.Client) *DynamoStore {
	tableName := os.Getenv("TASKS_TABLE")
	if tableName == "" {
		tableName = "tasks"
	}
	return &DynamoStore{client: client, tasksTable: tableName}
}

func (s *DynamoStore) ListTasks(ctx context.Context, roomID string) ([]Task, error) {
	out, err := s.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(s.tasksTable),
		KeyConditionExpression: aws.String("roomId = :rid"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":rid": &types.AttributeValueMemberS{Value: roomID},
		},
	})
	if err != nil {
		return nil, err
	}

	tasks := make([]Task, 0, len(out.Items))
	for _, item := range out.Items {
		t := unmarshalTask(item)
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func (s *DynamoStore) CreateTask(ctx context.Context, t *Task) error {
	if t.CreatedAt == "" {
		now := time.Now().UTC().Format(time.RFC3339)
		t.CreatedAt = now
		t.UpdatedAt = now
	}
	_, err := s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.tasksTable),
		Item:      marshalTask(t),
	})
	return err
}

func (s *DynamoStore) GetTask(ctx context.Context, roomID, taskID string) (*Task, error) {
	out, err := s.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(s.tasksTable),
		Key: map[string]types.AttributeValue{
			"roomId": &types.AttributeValueMemberS{Value: roomID},
			"taskId": &types.AttributeValueMemberS{Value: taskID},
		},
	})
	if err != nil {
		return nil, err
	}
	if out.Item == nil {
		return nil, ErrTaskNotFound
	}
	t := unmarshalTask(out.Item)
	return &t, nil
}

func (s *DynamoStore) UpdateTask(ctx context.Context, t *Task) error {
	t.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	_, err := s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.tasksTable),
		Item:      marshalTask(t),
	})
	return err
}

func (s *DynamoStore) DeleteTask(ctx context.Context, roomID, taskID string) error {
	_, err := s.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(s.tasksTable),
		Key: map[string]types.AttributeValue{
			"roomId": &types.AttributeValueMemberS{Value: roomID},
			"taskId": &types.AttributeValueMemberS{Value: taskID},
		},
		// タスクが存在しない場合にエラーにする
		ConditionExpression: aws.String("attribute_exists(taskId)"),
	})
	if err != nil {
		var condErr *types.ConditionalCheckFailedException
		if errors.As(err, &condErr) {
			return ErrTaskNotFound
		}
		return err
	}
	return nil
}

// ─── marshaling helpers ───────────────────────────────────────

func marshalTask(t *Task) map[string]types.AttributeValue {
	item := map[string]types.AttributeValue{
		"roomId":          &types.AttributeValueMemberS{Value: t.RoomID},
		"taskId":          &types.AttributeValueMemberS{Value: t.TaskID},
		"auctionUrl":      &types.AttributeValueMemberS{Value: t.AuctionURL},
		"requestedAmount": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", t.RequestedAmount)},
		"status":          &types.AttributeValueMemberS{Value: string(t.Status)},
		"statusHistory":   marshalStatusHistory(t.StatusHistory),
		"createdAt":       &types.AttributeValueMemberS{Value: t.CreatedAt},
		"updatedAt":       &types.AttributeValueMemberS{Value: t.UpdatedAt},
	}
	if t.BidAmount != nil {
		item["bidAmount"] = &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", *t.BidAmount)}
	}
	return item
}

func marshalStatusHistory(history []StatusEntry) types.AttributeValue {
	list := make([]types.AttributeValue, len(history))
	for i, e := range history {
		m := map[string]types.AttributeValue{
			"status":    &types.AttributeValueMemberS{Value: string(e.Status)},
			"timestamp": &types.AttributeValueMemberS{Value: e.Timestamp},
		}
		if e.Amount != nil {
			m["amount"] = &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", *e.Amount)}
		}
		list[i] = &types.AttributeValueMemberM{Value: m}
	}
	return &types.AttributeValueMemberL{Value: list}
}

func unmarshalTask(item map[string]types.AttributeValue) Task {
	t := Task{StatusHistory: []StatusEntry{}}
	if v, ok := item["roomId"].(*types.AttributeValueMemberS); ok {
		t.RoomID = v.Value
	}
	if v, ok := item["taskId"].(*types.AttributeValueMemberS); ok {
		t.TaskID = v.Value
	}
	if v, ok := item["auctionUrl"].(*types.AttributeValueMemberS); ok {
		t.AuctionURL = v.Value
	}
	if v, ok := item["requestedAmount"].(*types.AttributeValueMemberN); ok {
		t.RequestedAmount, _ = strconv.ParseInt(v.Value, 10, 64)
	}
	if v, ok := item["status"].(*types.AttributeValueMemberS); ok {
		t.Status = TaskStatus(v.Value)
	}
	if v, ok := item["bidAmount"].(*types.AttributeValueMemberN); ok {
		amount, _ := strconv.ParseInt(v.Value, 10, 64)
		t.BidAmount = &amount
	}
	if v, ok := item["createdAt"].(*types.AttributeValueMemberS); ok {
		t.CreatedAt = v.Value
	}
	if v, ok := item["updatedAt"].(*types.AttributeValueMemberS); ok {
		t.UpdatedAt = v.Value
	}
	if v, ok := item["statusHistory"].(*types.AttributeValueMemberL); ok {
		t.StatusHistory = unmarshalStatusHistory(v.Value)
	}
	return t
}

func unmarshalStatusHistory(list []types.AttributeValue) []StatusEntry {
	result := make([]StatusEntry, 0, len(list))
	for _, item := range list {
		m, ok := item.(*types.AttributeValueMemberM)
		if !ok {
			continue
		}
		var e StatusEntry
		if v, ok := m.Value["status"].(*types.AttributeValueMemberS); ok {
			e.Status = TaskStatus(v.Value)
		}
		if v, ok := m.Value["timestamp"].(*types.AttributeValueMemberS); ok {
			e.Timestamp = v.Value
		}
		if v, ok := m.Value["amount"].(*types.AttributeValueMemberN); ok {
			amount, _ := strconv.ParseInt(v.Value, 10, 64)
			e.Amount = &amount
		}
		result = append(result, e)
	}
	return result
}
