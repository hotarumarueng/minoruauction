package response

import (
	"encoding/json"

	"github.com/aws/aws-lambda-go/events"
)

// ErrorDetail はエラーの詳細を表す。
type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// ErrorResponse はすべてのエラーレスポンスの共通形式。
// {"error": {"code": "...", "message": "..."}}
type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

// NewErrorResponse は ErrorResponse を生成する。
func NewErrorResponse(code, message string) ErrorResponse {
	return ErrorResponse{
		Error: ErrorDetail{Code: code, Message: message},
	}
}

// ToAPIGatewayErrorResponse は HTTP ステータスコードと ErrorResponse を
// API Gateway のレスポンス形式に変換する。
func ToAPIGatewayErrorResponse(statusCode int, code, message string) events.APIGatewayProxyResponse {
	body, _ := json.Marshal(NewErrorResponse(code, message))
	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       string(body),
	}
}

// ToAPIGatewayResponse は任意のオブジェクトを 200 レスポンスに変換する。
func ToAPIGatewayResponse(statusCode int, v any) events.APIGatewayProxyResponse {
	body, _ := json.Marshal(v)
	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       string(body),
	}
}
