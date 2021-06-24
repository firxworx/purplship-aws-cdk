import * as cdk from '@aws-cdk/core'
import * as ecr from '@aws-cdk/aws-ecr'
import * as ecs from '@aws-cdk/aws-ecs'
import * as logs from '@aws-cdk/aws-logs'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns'
import { RdsPostgresInstance } from '../constructs/rds-postgres-instance'

// import * as route53 from '@aws-cdk/aws-route53'
// import * as route53Targets from '@aws-cdk/aws-route53-targets'

export interface PurplshipStackProps extends cdk.StackProps {
  port?: number

  databaseName?: string

  serviceName?: string
  containerName?: string

  fargateTaskCount?: number
  fargateTaskMemoryLimit?: number
  fargateTaskCpuLimit?: number

  publicFacing?: boolean
  containerInsights?: boolean
}

export class PurplshipStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: PurplshipStackProps) {
    super(scope, id, props)

    const port = props.port ?? 5002
    const databaseName = props.databaseName ?? 'purplship'
    const fargateTaskCount = props.fargateTaskCount ?? 1
    const fargateTaskMemoryLimit = props.fargateTaskMemoryLimit ?? 4096
    const fargateTaskCpuLimit = props.fargateTaskCpuLimit ?? 2048

    const vpc = new ec2.Vpc(this, 'VPC', {
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

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: vpc,
      clusterName: 'purplship',
      containerInsights: props?.containerInsights ?? false,
    })

    const postgres = new RdsPostgresInstance(this, 'DB', {
      vpc,
      databaseName,
    })

    const repository = ecr.Repository.fromRepositoryName(this, 'Repository', 'purplship/purplship-server')

    const loadBalancedFargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'LoadBalancedFargate',
      {
        cluster,
        publicLoadBalancer: props.publicFacing ?? true,
        serviceName: props.serviceName ?? 'purplship',
        taskImageOptions: {
          containerName: props.containerName ?? 'purplship',
          image: ecs.ContainerImage.fromEcrRepository(repository),
          containerPort: port,
          environment: {
            DEBUG_MODE: 'True',
            ALLOWED_HOSTS: '*',
            DATABASE_HOST: postgres.instance.dbInstanceEndpointAddress,
            DATABASE_PORT: postgres.instance.dbInstanceEndpointPort,
            DATABASE_NAME: databaseName,
            DATABASE_ENGINE: 'postgresql_psycopg2',
          },
          secrets: {
            DATABASE_USERNAME: ecs.Secret.fromSecretsManager(postgres.secret, 'username'),
            DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(postgres.secret, 'password'),
          },
          enableLogging: true,
          logDriver: ecs.LogDriver.awsLogs({
            streamPrefix: 'purplship-server',
            logGroup: new logs.LogGroup(this, 'LogGroup', {
              logGroupName: '/aws/ecs/purplship-server',
              retention: logs.RetentionDays.ONE_DAY,
              removalPolicy: cdk.RemovalPolicy.DESTROY,
            }),
          }),
        },
        desiredCount: fargateTaskCount,
        memoryLimitMiB: fargateTaskMemoryLimit,
        cpu: fargateTaskCpuLimit,
        // certificate
        // domainName
        // domainZone
        // propagateTags
      },
    )

    // trailing slash is important to ensure http 200 response
    loadBalancedFargateService.targetGroup.configureHealthCheck({
      path: '/login/',
      healthyHttpCodes: '200-299',
    })

    // allow database connections from fargate service
    postgres.instance.connections.allowFrom(
      loadBalancedFargateService.service,
      ec2.Port.tcp(postgres.instance.instanceEndpoint.port),
    )

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
    })

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: loadBalancedFargateService.loadBalancer.loadBalancerDnsName,
    })
  }
}
