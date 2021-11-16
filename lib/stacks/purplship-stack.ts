import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as ecs from '@aws-cdk/aws-ecs'
import * as logs from '@aws-cdk/aws-logs'
import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns'
// import * as route53 from '@aws-cdk/aws-route53'
// import * as route53Targets from '@aws-cdk/aws-route53-targets'

import { DEFAULT_DOCKER_IMAGE, DEFAULT_NAME, DEFAULT_PORT } from '../constants/purplship'
import { RdsPostgresInstance } from '../constructs/rds-postgres-instance'
import { getPythonBooleanString } from '../helpers/env-vars'
import { PurplshipSecrets } from '../constructs/purplship-secrets'

/**
 * Props related to purplship-server's environment variables.
 */
export interface PurplShipEnvProps {
  ADMIN_EMAIL: string
  DEBUG_MODE?: boolean
  USE_HTTPS?: boolean
  ALLOWED_HOSTS?: string
  PURPLSHIP_WORKERS?: number
  BACKGROUND_WORKERS?: number
  DETACHED_WORKER?: boolean
  WORK_DIR?: string
  LOG_DIR?: string
  WORKER_DB_DIR?: string
  STATIC_ROOT_DIR?: string
}

/**
 * Props supported by the `PurplshipStack` AWS CDK stack.
 */
export interface PurplshipStackProps extends cdk.StackProps {
  dockerImage?: string
  publicFacing?: boolean
  port?: number
  vpc?: ec2.Vpc
  serviceName?: string
  containerName?: string
  databaseName?: string
  fargateTaskCount?: number
  fargateTaskMemoryLimit?: number
  fargateTaskCpuLimit?: number
  fargateTaskLogDriver?: ecs.LogDriver
  containerInsights?: boolean
  purplshipEnv: PurplShipEnvProps
}

/**
 * Stack to deploy the purplship-server docker image on a VPC powered by Fargate and an
 * Application LOad Balancer.
 *
 * This stack creates all dependencies including a VPC, cluser, and a postgres instance on RDS.
 *
 * The admin credentials, application secret key, and database credentials will be created as
 * secrets via Secrets Manager. All passwords/keys will be automatically generated and the ARN's of
 * each secret will be saved to SSM.
 *
 * Refer to the `OutputLoadBalancerDnsName` in the stack's console output to confirm the URL of the
 * Application Load Balancer to access the purplship-server admin interface.
 *
 * The admin email and password will be displayed in the stack's console output if the
 * `outputAdminCredentials` flag is set to `true`. This flag should be `false` (or the
 * feature should be removed entirely) for production applications.
 */
export class PurplshipStack extends cdk.Stack {
  readonly vpc: ec2.Vpc
  readonly cluster: ecs.Cluster
  readonly loadBalancedFargateService: ecsPatterns.ApplicationLoadBalancedFargateService

  readonly secrets: PurplshipSecrets['secrets']

  constructor(scope: cdk.Construct, id: string, props: PurplshipStackProps) {
    super(scope, id, props)

    this.vpc =
      props.vpc ??
      new ec2.Vpc(this, 'VPC', {
        cidr: '10.0.0.0/16',
        maxAzs: 2,
        subnetConfiguration: [
          {
            name: 'Public',
            cidrMask: 24,
            subnetType: ec2.SubnetType.PUBLIC,
          },
          {
            name: 'Private',
            cidrMask: 24,
            subnetType: ec2.SubnetType.PRIVATE,
          },
          {
            name: 'Isolated',
            cidrMask: 24,
            subnetType: ec2.SubnetType.ISOLATED,
          },
        ],
        natGateways: 1,
        natGatewaySubnets: {
          subnetGroupName: 'Public',
        },
      })

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: this.vpc,
      clusterName: `${DEFAULT_NAME}-cluster`,
      containerInsights: props.containerInsights ?? false,
    })

    this.secrets = new PurplshipSecrets(this, 'Secrets', {
      adminEmail: props.purplshipEnv.ADMIN_EMAIL,
    }).secrets

    const postgres = new RdsPostgresInstance(this, 'Database', {
      vpc: this.vpc,
      databaseName: props.databaseName ?? DEFAULT_NAME,
      secret: this.secrets.db.secret,
    })

    // if you have pushed your desired purplship-server image to aws ecr:
    // const repository = ecr.Repository.fromRepositoryName(this, 'Repository', 'purplship/purplship-server')
    //
    // and then under `taskImageOptions` below replace the `image` line with:
    // image: ecs.ContainerImage.fromEcrRepository(repository),

    this.loadBalancedFargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'LoadBalancedFargate',
      {
        cluster: this.cluster,
        publicLoadBalancer: props.publicFacing ?? true,
        serviceName: props.serviceName ?? `${DEFAULT_NAME}-service`,
        taskImageOptions: {
          containerName: props.containerName ?? `${DEFAULT_NAME}-container`,
          image: ecs.ContainerImage.fromRegistry(props.dockerImage ?? DEFAULT_DOCKER_IMAGE),
          containerPort: props.port ?? DEFAULT_PORT,
          environment: {
            DEBUG_MODE: getPythonBooleanString(props.purplshipEnv?.DEBUG_MODE ?? true),
            ALLOWED_HOSTS: props.purplshipEnv.ALLOWED_HOSTS ?? '*',
            DATABASE_HOST: postgres.instance.dbInstanceEndpointAddress,
            DATABASE_PORT: postgres.instance.dbInstanceEndpointPort,
            DATABASE_NAME: props.databaseName ?? DEFAULT_NAME,
            DATABASE_ENGINE: 'postgresql_psycopg2',
            USE_HTTPS: getPythonBooleanString(props.purplshipEnv.USE_HTTPS ?? false),
            PURPLSHIP_WORKERS: `${props.purplshipEnv.PURPLSHIP_WORKERS ?? 2}`,
            BACKGROUND_WORKERS: `${props.purplshipEnv.BACKGROUND_WORKERS ?? 2}`,
            DETACHED_WORKER: getPythonBooleanString(props.purplshipEnv.DETACHED_WORKER ?? false),
            WORK_DIR: props.purplshipEnv.WORK_DIR ?? '/pship/app',
            LOG_DIR: props.purplshipEnv.LOG_DIR ?? '/pship/log',
            WORKER_DB_DIR: props.purplshipEnv.WORKER_DB_DIR ?? '/pship/data',
            STATIC_ROOT_DIR: props.purplshipEnv.STATIC_ROOT_DIR ?? '/pship/static',
          },
          secrets: {
            DATABASE_USERNAME: ecs.Secret.fromSecretsManager(this.secrets.db.secret, 'username'),
            DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(this.secrets.db.secret, 'password'),
            ADMIN_EMAIL: ecs.Secret.fromSecretsManager(this.secrets.admin.secret, 'email'),
            ADMIN_PASSWORD: ecs.Secret.fromSecretsManager(this.secrets.admin.secret, 'password'),
            SECRET_KEY: ecs.Secret.fromSecretsManager(this.secrets.app.secret, 'key'),
          },
          enableLogging: true,
          logDriver:
            props.fargateTaskLogDriver ??
            ecs.LogDriver.awsLogs({
              streamPrefix: `${DEFAULT_NAME}-server`,
              logGroup: new logs.LogGroup(this, 'LogGroup', {
                logGroupName: '/aws/ecs/purplship-server',
                retention: logs.RetentionDays.ONE_WEEK,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
              }),
            }),
        },
        desiredCount: props.fargateTaskCount ?? 1,
        memoryLimitMiB: props.fargateTaskMemoryLimit ?? 4096,
        cpu: props.fargateTaskCpuLimit ?? 2048,

        // certificate
        // domainName
        // domainZone

        // propagateTags
      },
    )

    // the trailing slash is important to ensure an http 200 response
    this.loadBalancedFargateService.targetGroup.configureHealthCheck({
      path: '/login/', // path: '/', // path: '/login/',
      healthyHttpCodes: '200-299',
    })

    // allow database connections from fargate service
    postgres.instance.connections.allowFrom(
      this.loadBalancedFargateService.service,
      ec2.Port.tcp(postgres.instance.instanceEndpoint.port),
    )

    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
    })
  }
}
