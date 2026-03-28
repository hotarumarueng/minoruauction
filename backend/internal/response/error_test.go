package response_test

import (
	"encoding/json"
	"testing"

	"github.com/toriumihotaru/minoru/internal/response"
)

func TestNewErrorResponse(t *testing.T) {
	tests := []struct {
		name    string
		code    string
		message string
	}{
		{
			name:    "404 roomNotFound",
			code:    "roomNotFound",
			message: "ルームが見つかりません",
		},
		{
			name:    "409 roomFull",
			code:    "roomFull",
			message: "このルームは既に2名が参加しています",
		},
		{
			name:    "422 invalidTransition",
			code:    "invalidTransition",
			message: "このステータスには変更できません",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := response.NewErrorResponse(tt.code, tt.message)
			if got.Error.Code != tt.code {
				t.Errorf("Code = %q, want %q", got.Error.Code, tt.code)
			}
			if got.Error.Message != tt.message {
				t.Errorf("Message = %q, want %q", got.Error.Message, tt.message)
			}
		})
	}
}

func TestErrorResponseJSON(t *testing.T) {
	er := response.NewErrorResponse("roomNotFound", "ルームが見つかりません")
	body, err := json.Marshal(er)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}

	var decoded map[string]interface{}
	if err := json.Unmarshal(body, &decoded); err != nil {
		t.Fatalf("json.Unmarshal failed: %v", err)
	}

	errObj, ok := decoded["error"].(map[string]interface{})
	if !ok {
		t.Fatal("response should have 'error' key")
	}
	if errObj["code"] != "roomNotFound" {
		t.Errorf("JSON error.code = %v, want roomNotFound", errObj["code"])
	}
	if errObj["message"] != "ルームが見つかりません" {
		t.Errorf("JSON error.message = %v, want ルームが見つかりません", errObj["message"])
	}
}

func TestAPIGatewayResponse(t *testing.T) {
	tests := []struct {
		statusCode int
		code       string
		message    string
	}{
		{400, "badRequest", "リクエストが不正です"},
		{404, "roomNotFound", "ルームが見つかりません"},
		{409, "roomFull", "このルームは既に2名が参加しています"},
		{422, "invalidTransition", "このステータスには変更できません"},
		{500, "internalError", "内部エラーが発生しました"},
	}

	for _, tt := range tests {
		t.Run(tt.code, func(t *testing.T) {
			resp := response.ToAPIGatewayErrorResponse(tt.statusCode, tt.code, tt.message)
			if resp.StatusCode != tt.statusCode {
				t.Errorf("StatusCode = %d, want %d", resp.StatusCode, tt.statusCode)
			}
			if resp.Headers["Content-Type"] != "application/json" {
				t.Errorf("Content-Type header missing or wrong: %v", resp.Headers)
			}
			if resp.Body == "" {
				t.Error("Body should not be empty")
			}
		})
	}
}
