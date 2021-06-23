# purplship-aws-cdk

AWS CDK stack in TypeScript to deploy [purplship-server](https://github.com/purplship/purplship-server).

[Purplship](https://purplship.com) is an open-source multi-carrier shipping platform.

Refer to `cdk.json` re configuration details that instruct CDK Toolkit how to execute this solution.

## Get Started

Ensure that you have a AWS account and that you have a valid AWS configuration in `~/.aws/config` including valid API credentials in `~/aws/credentials`.

A global installation of the `aws-cdk` package is recommended: `yarn global add aws-cdk`.

Run `cdk --version` to confirm your installation.

If this is your first time with this project, install this project's dependencies by running: `yarn`.

If this is your first time using AWS CDK with this particular AWS account, run `cdk bootstrap` from the root of the project folder to bootstrap your environment and create the resources on AWS that AWS-CDK requires to run.

AWS CDK is frequently updated. It is highly recommended that you run the latest versions of all packages. To check for any available updates and install them you can use yarn's `upgrade-interactive` feature:

```sh
# review potential updates for globally installed packages
yarn global upgrade-interactive --latest

# review potential updates for packages in this project
yarn upgrade-interactive --latest
```

It is important for the globally installed version of `aws-cdk` has the same version number as the `@aws-cdk`-related dependencies listed in `package.json`.

## Commands

- `yarn build` compile typescript to js
- `yarn watch` watch for changes and compile
- `yarn test` perform the jest unit tests

- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template
