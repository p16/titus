import {MiraStack} from "mira";
import {Construct, Duration, RemovalPolicy, Stack} from '@aws-cdk/core'
import {
  AuthorizationType,
  CfnAuthorizer,
  ConnectionType,
  Cors,
  Deployment,
  Integration,
  IntegrationType,
  LambdaIntegration,
  LogGroupLogDestination,
  ProxyResource,
  RestApi,
  Stage,
  VpcLink
} from '@aws-cdk/aws-apigateway'

import {IVpc} from "@aws-cdk/aws-ec2";
import {NetworkLoadBalancer} from '@aws-cdk/aws-elasticloadbalancingv2'
import {LogGroup, RetentionDays} from '@aws-cdk/aws-logs'
import {resolve} from "path";
import {Code, Function, Runtime} from "@aws-cdk/aws-lambda";

interface ApiGatewayNlbProps {
  nlb: NetworkLoadBalancer,
  vpc: IVpc,
  userPoolArn: string
}

export class ApiGatewayNlb extends MiraStack {
  public api: RestApi

  public url: string

  constructor(scope: Construct, props: ApiGatewayNlbProps) {
    super(scope, 'TitusApiGatewayNlb')

    const corsOptions = {
      allowOrigins: Cors.ALL_ORIGINS,
      allowMethods: Cors.ALL_METHODS,
      allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'X-auth-id']
    }

    this.api = new RestApi(scope, 'TitusRestApi', {
      description: 'Titus API',
      // deploy: false,
      defaultCorsPreflightOptions: corsOptions
    })

    /**
     * This lambda create a config file required for the frontend.
     * https://${this.api.restApiId}.execute-api.${Stack.of(this).region}.amazonaws.com/prod/config/v1
     */
    const configLambda = new LambdaIntegration(
      new Function(this, 'GetConfigFunction', {
        code: Code.fromAsset(
          resolve(__dirname, '..', '..', 'lambda')
        ),
        environment: {
          CORS_ORIGIN: '*',
          CORS_CREDENTIALS: 'true',
          /**
           * To add values to the config add an environment variable that starts with `APP_CONFIG_`
           *
           * The attributes below returns something like:
           *
           * {
           *   identityPoolId: 'xxxxxxx',
           *   region: 'xxxxxxx',
           *   userPoolId: 'xxxxxxx',
           *   userPoolWebClientId: 'xxxxxxx',
           * }
           */
          APP_CONFIG_identityPoolId: this.loadParameter('Titus/IdentityPoolId').stringValue,
          APP_CONFIG_region: Stack.of(this).region,
          APP_CONFIG_userPoolId: this.loadParameter('Titus/UserPoolId').stringValue,
          APP_CONFIG_userPoolWebClientId: this.loadParameter('Titus/WebClientId').stringValue
        },
        handler: 'get-config.handler',
        runtime: Runtime.NODEJS_12_X,
        timeout: Duration.minutes(1)
      })
    )

    this.api.root
      .addResource('config')
      .addResource('v1')
      .addMethod('GET', configLambda)

    const v1 = this.api.root.addResource('api').addResource('v1')

    const link = new VpcLink(this, 'ElbLink', {
      targets: [props.nlb],
    });

    const integration = new Integration({
      type: IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'ANY',
      uri: this.buildLBEndpoint(props.nlb.loadBalancerDnsName),
      options: {
        // You can define mapping parameters from your method to your integration
        // - Destination parameters (the key) are the integration parameters (used in mappings)
        // - Source parameters (the value) are the source request parameters or expressions
        // @see: https://docs.aws.amazon.com/apigateway/latest/developerguide/request-response-data-mappings.html
        // 'integration.request.querystring.who': 'method.request.querystring.who'
        requestParameters: {
          'integration.request.path.proxy': 'method.request.path.proxy'
        },
        connectionType: ConnectionType.VPC_LINK,
        vpcLink: link,
      },
    })

    const auth = new CfnAuthorizer(this, 'APIGatewayAuthorizer', {
      name: 'customer-authorizer',
      identitySource: 'method.request.header.Authorization',
      providerArns: [props.userPoolArn],
      restApiId: this.api.restApiId,
      type: AuthorizationType.COGNITO,
    })

    new ProxyResource(this, 'TitusApiGWProxyResource', {
      anyMethod: true,
      defaultIntegration: integration,
      parent: v1,
      defaultCorsPreflightOptions: corsOptions,
      defaultMethodOptions: {
        authorizationType: AuthorizationType.COGNITO,
        authorizer: {authorizerId: auth.ref},
        requestParameters: {'method.request.path.proxy': true}
      },
    })

    /**
     * The code below is required to deploy the API in a separate step.
     * IS currently not working because the config lambda cause a Circular dependency error.
     * To test uncommend the code below and the `deploy: false` in the `RestApi` constructor options
     **/
    // this.deployTo('prod')

    this.url = `https://${this.api.restApiId}.execute-api.${Stack.of(this).region}.amazonaws.com/prod`
    this.addOutput('ApiURLProd', `https://${this.api.restApiId}.execute-api.${Stack.of(this).region}.amazonaws.com/prod`)
  }

  /**
   * o deploy the API in a separate step
   * @param stage
   * @private
   */
  private deployTo(stage: string) {
    const deployment = new Deployment(this, 'TitusApiGWDeployment', {
      api: this.api,
      description: `${stage} deployment`
    })

    const logGroupProd = new LogGroup(this, `ApiGWLogGroup${stage}`, {
      logGroupName: `/aws/api-gateway/titus-api-${stage}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.ONE_DAY
    })
    new Stage(this, 'ApiGWDevStageDev', {
      deployment,
      stageName: stage,
      accessLogDestination: new LogGroupLogDestination(logGroupProd),
    })
  }

  private buildLBEndpoint(dnsName: string) {
    return `http://${dnsName}/{proxy}`
  }
}
