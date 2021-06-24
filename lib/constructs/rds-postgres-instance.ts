import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as rds from '@aws-cdk/aws-rds'
import * as ssm from '@aws-cdk/aws-ssm'
import * as secretsManager from '@aws-cdk/aws-secretsmanager'

export interface RdsPostgresInstanceProps {
  vpc: ec2.Vpc
  vpcSubnets?: ec2.SubnetSelection
  secret?: secretsManager.Secret

  databaseName?: string
  instanceIdentifier?: string
  version?: rds.PostgresEngineVersion
  multiAz?: boolean
}

/**
 * Construct to create an RDS Postgres instance.
 *
 * If no `secret` is provided via Props, this construct will generate one and expose it via the
 * class property `secret`. This construct will also create an SSM parameter with the ARN.
 *
 * This construct expects a `vpc` and `securityGroups` to be provided as props.
 *
 * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html
 */
export class RdsPostgresInstance extends cdk.Construct {
  readonly instance: rds.DatabaseInstance

  readonly proxy: rds.DatabaseProxy | undefined

  readonly secret: secretsManager.ISecret
  readonly secretArn: ssm.StringParameter

  constructor(scope: cdk.Construct, id: string, props: RdsPostgresInstanceProps) {
    super(scope, id)

    this.secret =
      props.secret ??
      new secretsManager.Secret(this, 'Secret', {
        secretName: 'purplship/db',
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            username: 'postgres',
          }),
          includeSpace: false,
          generateStringKey: 'password',
        },
      })

    this.instance = new rds.DatabaseInstance(this, 'Postgres', {
      vpc: props.vpc,
      databaseName: props.databaseName ?? 'purplship',
      instanceIdentifier: 'purplship',
      port: 5432,
      multiAz: props.multiAz ?? false,

      engine: rds.DatabaseInstanceEngine.postgres({
        version: props.version ?? rds.PostgresEngineVersion.VER_13_2,
      }),

      credentials: {
        username: this.secret.secretValueFromJson('username').toString(),
        password: this.secret.secretValueFromJson('password'),
      },
    })

    this.secretArn = new ssm.StringParameter(this, 'SecretArn', {
      parameterName: `purplship-db-secret-arn`,
      stringValue: this.secret.secretArn,
    })
  }
}
