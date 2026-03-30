import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as iam from "aws-cdk-lib/aws-iam";
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
      timeToLiveAttribute: "expireAt",
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
        path.join(__dirname, "../lambda-assets/room-handler"),
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
        path.join(__dirname, "../lambda-assets/task-handler"),
      ),
      environment: {
        ROOMS_TABLE: roomsTable.tableName,
        TASKS_TABLE: tasksTable.tableName,
      },
    });

    roomsTable.grantReadWriteData(roomHandler);
    roomsTable.grantReadData(taskHandler);
    tasksTable.grantReadWriteData(taskHandler);

    // --- SNS Platform Application ARN（SSM Parameter Store で管理） ---
    // Secrets Manager（$0.40/月）ではなく SSM Standard Parameter（無料）を使用する。
    // Lambda は SNS Platform App ARN のみを実行時に知れば良い。
    // FCM Service Account JSON は SNS Platform App 作成時にのみ使うため Lambda には不要。
    //
    // 事前準備（初回デプロイ前に1回だけ実行）:
    //   aws ssm put-parameter \
    //     --name /minoru/sns-fcm-platform-app-arn \
    //     --type String \
    //     --value "arn:aws:sns:ap-northeast-1:ACCOUNT_ID:app/GCM/minoru-fcm"
    const fcmPlatformAppArn = ssm.StringParameter.valueForStringParameter(
      this,
      "/minoru/sns-fcm-platform-app-arn",
    );

    taskHandler.addEnvironment("SNS_FCM_PLATFORM_APP_ARN", fcmPlatformAppArn);

    // SNS Publish + CreatePlatformEndpoint 権限を TaskHandler に付与
    taskHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["sns:CreatePlatformEndpoint", "sns:Publish"],
        resources: ["*"],
      }),
    );

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
      { payloadFormatVersion: apigwv2.PayloadFormatVersion.VERSION_1_0 },
    );
    const taskIntegration = new apigwv2integrations.HttpLambdaIntegration(
      "TaskIntegration",
      taskHandler,
      { payloadFormatVersion: apigwv2.PayloadFormatVersion.VERSION_1_0 },
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
      path: "/rooms",
      methods: [apigwv2.HttpMethod.ANY],
      integration: roomIntegration,
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
