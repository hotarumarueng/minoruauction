import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { MinoruStack } from "../lib/minoru-stack";

describe("MinoruStack", () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new MinoruStack(app, "TestMinoruStack");
    template = Template.fromStack(stack);
  });

  describe("DynamoDB テーブル", () => {
    it("rooms テーブルが存在する（PK: roomId）", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "rooms",
        KeySchema: [{ AttributeName: "roomId", KeyType: "HASH" }],
        AttributeDefinitions: [
          { AttributeName: "roomId", AttributeType: "S" },
        ],
        BillingMode: "PAY_PER_REQUEST",
      });
    });

    it("tasks テーブルが存在する（PK: roomId, SK: taskId）", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "tasks",
        KeySchema: [
          { AttributeName: "roomId", KeyType: "HASH" },
          { AttributeName: "taskId", KeyType: "RANGE" },
        ],
        AttributeDefinitions: [
          { AttributeName: "roomId", AttributeType: "S" },
          { AttributeName: "taskId", AttributeType: "S" },
        ],
        BillingMode: "PAY_PER_REQUEST",
      });
    });
  });

  describe("Lambda 関数", () => {
    it("RoomHandler が arm64 / provided.al2023 で存在する", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: "room-handler",
        Runtime: "provided.al2023",
        Architectures: ["arm64"],
        Handler: "bootstrap",
      });
    });

    it("TaskHandler が arm64 / provided.al2023 で存在する", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: "task-handler",
        Runtime: "provided.al2023",
        Architectures: ["arm64"],
        Handler: "bootstrap",
      });
    });
  });

  describe("API Gateway HTTP API", () => {
    it("HTTP API が存在する", () => {
      template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
      template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
        ProtocolType: "HTTP",
      });
    });

    it("RoomHandler へのルートが存在する（/rooms）", () => {
      template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
        RouteKey: "ANY /rooms/{proxy+}",
      });
    });

    it("TaskHandler へのルートが存在する（/rooms/{roomId}/tasks）", () => {
      template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
        RouteKey: "ANY /rooms/{roomId}/tasks/{proxy+}",
      });
    });
  });
});
