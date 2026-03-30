package room

import (
	"context"
	"errors"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// DynamoStore は DynamoDB を使った Store 実装。
type DynamoStore struct {
	client    *dynamodb.Client
	roomTable string
}

// NewDynamoStore は環境変数 ROOMS_TABLE からテーブル名を読み込んで DynamoStore を生成する。
func NewDynamoStore(client *dynamodb.Client) *DynamoStore {
	tableName := os.Getenv("ROOMS_TABLE")
	if tableName == "" {
		tableName = "rooms"
	}
	return &DynamoStore{client: client, roomTable: tableName}
}

func (s *DynamoStore) CreateRoom(ctx context.Context, r *Room) error {
	if r.CreatedAt == "" {
		r.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}

	item := map[string]types.AttributeValue{
		"roomId":       &types.AttributeValueMemberS{Value: r.RoomID},
		"createdAt":    &types.AttributeValueMemberS{Value: r.CreatedAt},
		"memberTokens": &types.AttributeValueMemberM{Value: map[string]types.AttributeValue{}},
	}

	_, err := s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.roomTable),
		Item:      item,
	})
	return err
}

func (s *DynamoStore) GetRoom(ctx context.Context, roomID string) (*Room, error) {
	out, err := s.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(s.roomTable),
		Key: map[string]types.AttributeValue{
			"roomId": &types.AttributeValueMemberS{Value: roomID},
		},
	})
	if err != nil {
		return nil, err
	}
	if out.Item == nil {
		return nil, ErrRoomNotFound
	}

	r := &Room{RoomID: roomID, MemberTokens: make(map[string]string)}

	if v, ok := out.Item["createdAt"].(*types.AttributeValueMemberS); ok {
		r.CreatedAt = v.Value
	}
	if mt, ok := out.Item["memberTokens"].(*types.AttributeValueMemberM); ok {
		for k, v := range mt.Value {
			if sv, ok := v.(*types.AttributeValueMemberS); ok {
				r.MemberTokens[k] = sv.Value
			}
		}
	}

	return r, nil
}

func (s *DynamoStore) UpdateMemberToken(ctx context.Context, roomID, role, deviceToken string) error {
	_, err := s.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(s.roomTable),
		Key: map[string]types.AttributeValue{
			"roomId": &types.AttributeValueMemberS{Value: roomID},
		},
		UpdateExpression:    aws.String("SET memberTokens.#role = :token"),
		ConditionExpression: aws.String("attribute_exists(roomId)"),
		ExpressionAttributeNames: map[string]string{
			"#role": role,
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":token": &types.AttributeValueMemberS{Value: deviceToken},
		},
	})
	if err != nil {
		var condErr *types.ConditionalCheckFailedException
		if errors.As(err, &condErr) {
			return ErrRoomNotFound
		}
		return err
	}
	return nil
}
