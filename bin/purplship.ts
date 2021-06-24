#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from '@aws-cdk/core'
import { PurplshipStack } from '../lib/stacks/purplship-stack'

// @see https://docs.aws.amazon.com/cdk/latest/guide/environments.html
const env = {
  account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
}

const app = new cdk.App()

// cdk synth PurplshipStack
// cdk deploy PurplshipStack
new PurplshipStack(app, 'PurplshipStack', {
  env,
})
