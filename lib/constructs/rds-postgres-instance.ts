import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as rds from '@aws-cdk/aws-rds'
import * as secretsManager from '@aws-cdk/aws-secretsmanager'

import { DEFAULT_NAME } from '../constants/purplship'

export interface RdsPostgresInstanceProps {
  /** secret (as a json object) specifying a `username` and `password` to use for this RDS instance. */
  secret: secretsManager.ISecret

  vpc: ec2.Vpc
  vpcSubnets?: ec2.SubnetSelection
  securityGroups?: Array<ec2.ISecurityGroup>
  databaseName?: string
  instanceIdentifier?: string
  instanceType?: ec2.InstanceType
  version?: rds.PostgresEngineVersion
  multiAz?: boolean
}

/**
 * Construct to create an RDS Postgres instance for purplship-server.
 *
 * The default configuration applied by this construct is suitable for **non-production** demonstration
 * and evaluation purposes only. If an `instanceType` is not provided via props, this construct
 * overrides CDK defaults and will launch a t3.micro instance.
 *
 * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html
 */
export class RdsPostgresInstance extends cdk.Construct {
  readonly instance: rds.DatabaseInstance

  constructor(scope: cdk.Construct, id: string, props: RdsPostgresInstanceProps) {
    super(scope, id)

    this.instance = new rds.DatabaseInstance(this, 'Postgres', {
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
      securityGroups: props.securityGroups,
      databaseName: props.databaseName ?? DEFAULT_NAME,
      instanceIdentifier: props.instanceIdentifier ?? DEFAULT_NAME,
      port: 5432,
      multiAz: props.multiAz ?? false,
      instanceType: props.instanceType ?? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      engine: rds.DatabaseInstanceEngine.postgres({
        version: props.version ?? rds.PostgresEngineVersion.VER_13_2,
      }),
      credentials: {
        username: props.secret.secretValueFromJson('username').toString(),
        password: props.secret.secretValueFromJson('password'),
      },
    })
  }
}
