#!/usr/bin/env node

import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class SessionManagerDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC
    const vpc = new ec2.Vpc(this, "SessionManagerDemoStackVPC", {
      maxAzs: 2, // Use 2 Availability Zones
      subnetConfiguration: [
        {
          name: "ingress",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: "application",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          name: "rds",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Create IAM role for EC2 instances
    const ec2Role = new iam.Role(this, "EC2Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
    });

    // Attach AmazonSSMManagedInstanceCore managed policy to the IAM role
    ec2Role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );

     // Create a security group
     const webSG = new ec2.SecurityGroup(this, 'webSG', {
      vpc,
      description: 'Allow inbound Web App traffic',
      allowAllOutbound: true, // Allow all outbound traffic
    });

    // Add an inbound rule to allow SSH traffic
    webSG.addIngressRule(ec2.Peer.anyIpv4() , ec2.Port.tcp(80), 'Allow web App traffic');

    // Create a security group
    const appSG = new ec2.SecurityGroup(this, 'appSG', {
      vpc,
      description: 'Allow inbound Web App traffic',
      allowAllOutbound: true, // Allow all outbound traffic
    });

    // Add an inbound rule to allow SSH traffic
    appSG.addIngressRule(webSG , ec2.Port.tcp(8080), 'Allow web App traffic');


     // Create a security group
     const dbSG = new ec2.SecurityGroup(this, 'PrivateIsolatedInstanceSG', {
      vpc,
      description: 'Allow traffic from App from Private Instance',
      allowAllOutbound: true, // Allow all outbound traffic
    });

    // Add an inbound rule to allow DB traffic
    dbSG.addIngressRule(appSG, ec2.Port.tcp(3306), 'Allow traffic from App Servers');



    // Create private subnet and EC2 instance
    const privateInstance = new ec2.Instance(this, "PrivateInstance", {
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.SMALL
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      role: ec2Role,
      securityGroup : appSG
    });

    // Create private subnet and EC2 instance
    const privateIsolatedInstance = new ec2.Instance(
      this,
      "PrivateIsolatedInstance",
      {
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.SMALL
        ),
        machineImage: ec2.MachineImage.latestAmazonLinux2(),
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        role: ec2Role,
        securityGroup : dbSG
      }
    );

    //Create Systems Manager VPC endpoint
    const ssmVpcEndpoint = new ec2.InterfaceVpcEndpoint(this, "SSMEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
      vpc,
      privateDnsEnabled: true,
      subnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        onePerAz: true,
      }),
    });

    //Create Systems Manager VPC endpoint
    const ssmMessageManagerVpcEndpoint = new ec2.InterfaceVpcEndpoint(this, "SSM_MESSAGESEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
      vpc,
      privateDnsEnabled: true,
      subnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        onePerAz: true,
      }),
    });

    //Create Systems Manager VPC endpoint
    const ec2MessageVpcEndpoint = new ec2.InterfaceVpcEndpoint(this, "EC2_MESSAGESEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
      vpc,
      privateDnsEnabled: true,
      subnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        onePerAz: true,
      }),
    });

    // Output the Systems Manager VPC endpoint ID
    new cdk.CfnOutput(this, "SSMEndpointId", {
      value: ssmVpcEndpoint.vpcEndpointId,
    });
  }
}

const app = new cdk.App();
new SessionManagerDemoStack(app, "SessionManagerDemoStack");
