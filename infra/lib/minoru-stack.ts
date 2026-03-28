import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";
import * as path from "path";

export class MinoruStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- DynamoDB ---
    const roomsTable = new dynamodb.Table(this, "RoomsTable", {
      tableName: "rooms",
      partitionKey: { name: "roomId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const tasksTable = new dynamodb.Table(this, "TasksTable", {
      tableName: "tasks",
      partitionKey: { name: "roomId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "taskId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // --- Lambda スタブ（Go arm64 / provided.al2023） ---
    const roomHandler = new lambda.Function(this, "RoomHandler", {
      functionName: "room-handler",
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: "bootstrap",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambda-stub"),
      ),
      environment: {
        ROOMS_TABLE: roomsTable.tableName,
      },
    });

    const taskHandler = new lambda.Function(this, "TaskHandler", {
      functionName: "task-handler",
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: "bootstrap",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambda-stub"),
      ),
      environment: {
        ROOMS_TABLE: roomsTable.tableName,
        TASKS_TABLE: tasksTable.tableName,
      },
    });

    roomsTable.grantReadWriteData(roomHandler);
    roomsTable.grantReadData(taskHandler);
    tasksTable.grantReadWriteData(taskHandler);

    // --- API Gateway HTTP API ---
    const api = new apigwv2.HttpApi(this, "MinoruApi", {
      apiName: "minoru-api",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    const roomIntegration = new apigwv2integrations.HttpLambdaIntegration(
      "RoomIntegration",
      roomHandler,
    );
    const taskIntegration = new apigwv2integrations.HttpLambdaIntegration(
      "TaskIntegration",
      taskHandler,
    );

    // /rooms 以下は RoomHandler（タスク系ルートより先に登録しない）
    api.addRoutes({
      path: "/rooms/{roomId}/tasks/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: taskIntegration,
    });
    api.addRoutes({
      path: "/rooms/{roomId}/tasks",
      methods: [apigwv2.HttpMethod.ANY],
      integration: taskIntegration,
    });
    api.addRoutes({
      path: "/rooms/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: roomIntegration,
    });

    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.apiEndpoint,
      description: "API Gateway endpoint URL",
    });
  }
}
