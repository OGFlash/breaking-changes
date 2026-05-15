#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BreakingChangesStack } from './breaking-changes-stack';

const app = new cdk.App();

new BreakingChangesStack(app, 'BreakingChangesStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  domainName: app.node.tryGetContext('domainName') ?? 'breakingchanges.dev',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  sesSenderEmail: process.env.SES_SENDER_EMAIL ?? '',
  adminEmail: process.env.ADMIN_EMAIL ?? '',
});
