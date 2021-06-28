import * as cdk from '@aws-cdk/core'
import * as ssm from '@aws-cdk/aws-ssm'
import * as secretsManager from '@aws-cdk/aws-secretsmanager'

import { DEFAULT_NAME } from '../constants/purplship'

export interface PurplshipSecretsProps {
  adminEmail: string
}

/**
 * Construct to generate admin + app + db secrets for purplship-server and save the ARN's
 * of each secret to SSM as string parameters.
 *
 * The db secret assumes that purplship is being deployed with a postgres database and
 * creates that secret with 'postgres' as the username.
 */
export class PurplshipSecrets extends cdk.Construct {
  readonly secrets: Record<
    'admin' | 'app' | 'db',
    {
      secret: secretsManager.ISecret
      arn: ssm.StringParameter
    }
  >

  constructor(scope: cdk.Construct, id: string, props: PurplshipSecretsProps) {
    super(scope, id)

    const adminSecret = new secretsManager.Secret(this, 'AdminSecret', {
      secretName: `${DEFAULT_NAME}/admin`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          email: props.adminEmail,
        }),
        excludePunctuation: true, // special characters can bork; issue reported
        generateStringKey: 'password',
      },
    })

    const adminSecretArn = new ssm.StringParameter(this, 'AdminSecretArn', {
      parameterName: `${DEFAULT_NAME}-admin-secret-arn`,
      stringValue: adminSecret.secretArn,
    })

    const dbSecret = new secretsManager.Secret(this, 'DatabaseSecret', {
      secretName: `${DEFAULT_NAME}/db`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'postgres',
        }),
        excludePunctuation: true,
        generateStringKey: 'password',
      },
    })

    const dbSecretArn = new ssm.StringParameter(this, 'DatabaseSecretArn', {
      parameterName: `${DEFAULT_NAME}-db-secret-arn`,
      stringValue: dbSecret.secretArn,
    })

    const appSecret = new secretsManager.Secret(this, 'AppSecret', {
      secretName: `${DEFAULT_NAME}/app`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        includeSpace: false,
        generateStringKey: 'key',
      },
    })

    const appSecretArn = new ssm.StringParameter(this, 'AppSecretArn', {
      parameterName: `${DEFAULT_NAME}-app-secret-arn`,
      stringValue: appSecret.secretArn,
    })

    this.secrets = {
      admin: {
        secret: adminSecret,
        arn: adminSecretArn,
      },
      db: {
        secret: dbSecret,
        arn: dbSecretArn,
      },
      app: {
        secret: appSecret,
        arn: appSecretArn,
      },
    }

    new cdk.CfnOutput(this, 'OutputAdminSecretArn', {
      value: adminSecret.secretArn,
    })

    new cdk.CfnOutput(this, 'OutputAppSecretArn', {
      value: appSecret.secretArn,
    })

    new cdk.CfnOutput(this, 'OutputDatabaseSecretArn', {
      value: dbSecret.secretArn,
    })
  }
}
