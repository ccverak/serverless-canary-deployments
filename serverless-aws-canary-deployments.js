'use strict'

class ServerlessCanaryDeployments {
  constructor (serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.awsProvider = this.serverless.getProvider('aws');
    this.naming = this.awsProvider.naming;
    this.service = this.serverless.service;
    this.withDeploymentPreferencesFns = this.serverless.service.getAllFunctions()
      .map(name => ({ name, obj: this.serverless.service.getFunction(name) }))
      .filter(fn => !!fn.obj.deploymentPreference);
    this.hooks = {
      'before:package:finalize': this.canary.bind(this)
    }
  }

  canary() {
    if (this.withDeploymentPreferencesFns.length > 0) {
      const compiledTpl = this.service.provider.compiledCloudFormationTemplate;
      this.addCodeDeployApp(compiledTpl);
      this.addCodeDeployRole(compiledTpl);
      this.withDeploymentPreferencesFns
        .forEach((fn) => {
          const normalizedFn = this.naming.getLambdaLogicalId(fn.name);
          const compiled = compiledTpl.Resources[normalizedFn];
          const fnVersion = Object.keys(compiledTpl.Resources).find(el => el.startsWith('HelloLambdaVersion'));  // FIXME
          const deploymentSettings = fn.obj.deploymentPreference;
          const deploymentGroupName = this.addFunctionDeploymentGroup({ deploymentSettings, compiledTpl, normalizedFn })
          this.addFunctionAlias({ deploymentSettings, compiledTpl, normalizedFn, deploymentGroupName, fnVersion })
        });
    }
  }

  addCodeDeployApp(compiledTpl) {
    const stackName = this.naming.getStackName();
    const normalizedStackName = this.naming.normalizeNameToAlphaNumericOnly(stackName);
    const codeDeployAppName = `${normalizedStackName}DeploymentApplication`;
    const codeDeployProps = {
      Type: 'AWS::CodeDeploy::Application',
      Properties: {
        ComputePlatform: 'Lambda'
      }
    };
    compiledTpl.Resources[codeDeployAppName] = codeDeployProps;
  }

  addCodeDeployRole(compiledTpl) {
    const logicalName = 'CodeDeployServiceRole';
    const codeDeployRole = {
      Type: 'AWS::IAM::Role',
      Properties: {
        ManagedPolicyArns: [
          'arn:aws:iam::aws:policy/service-role/AWSCodeDeployRoleForLambda',
          'arn:aws:iam::aws:policy/AWSLambdaFullAccess' // FIX: determine exactly what permissions are needed for executing hooks
        ],
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: [ 'sts:AssumeRole' ],
              Effect: 'Allow',
              Principal: { Service: [ 'codedeploy.amazonaws.com' ] }
            }
          ]
        }
      }
    };
    compiledTpl.Resources[logicalName] = codeDeployRole;
  }

  addFunctionDeploymentGroup({ codeDeployAppName = 'AwsnodejsdevDeploymentApplication', deploymentSettings, compiledTpl, normalizedFn }) {
    const logicalName = `${normalizedFn}DeploymentGroup`;
    const deploymentGroup = {
      Type: 'AWS::CodeDeploy::DeploymentGroup',
      Properties: {
        ApplicationName: {
          Ref: codeDeployAppName
        },
        AlarmConfiguration: {
          Alarms: deploymentSettings.alarms.map(a => ({ Name: { Ref: a } })),
          Enabled: true
        },
        AutoRollbackConfiguration: {
          Enabled: true,
          Events: [
            'DEPLOYMENT_FAILURE',
            'DEPLOYMENT_STOP_ON_ALARM',
            'DEPLOYMENT_STOP_ON_REQUEST'
          ]
        },
        ServiceRoleArn: {
          'Fn::GetAtt': [
            'CodeDeployServiceRole',
            'Arn'
          ]
        },
        DeploymentConfigName: {
          'Fn::Sub': [
            'CodeDeployDefault.Lambda${ConfigName}',
            { ConfigName: deploymentSettings.type }
          ]
        },
        DeploymentStyle: {
          DeploymentType: 'BLUE_GREEN',
          DeploymentOption: 'WITH_TRAFFIC_CONTROL'
        }
      }
    };
    compiledTpl.Resources[logicalName] = deploymentGroup;
    return logicalName;
  }

  addFunctionAlias({ deploymentSettings = {}, codeDeployApp = 'AwsnodejsdevDeploymentApplication', compiledTpl, normalizedFn, appName, deploymentGroupName, fnVersion }) {
    const beforeHookFn = this.naming.getLambdaLogicalId(deploymentSettings.preTrafficHook);
    const afterHookFn = this.naming.getLambdaLogicalId(deploymentSettings.postTrafficHook);
    const fnAlias = {
      Type: 'AWS::Lambda::Alias',
      UpdatePolicy: {
        CodeDeployLambdaAliasUpdate: {
          ApplicationName: { Ref: codeDeployApp },
          AfterAllowTrafficHook: { Ref: afterHookFn },
          BeforeAllowTrafficHook: { Ref: beforeHookFn },
          DeploymentGroupName: { Ref: deploymentGroupName }
        }
      },
      Properties: {
        FunctionVersion: { 'Fn::GetAtt': [ fnVersion, 'Version' ] },
        FunctionName: { Ref: normalizedFn },
        Name: deploymentSettings.alias
      }
    };
    compiledTpl.Resources[`${normalizedFn}Alias${deploymentSettings.alias}`] = fnAlias;
  }
}

module.exports = ServerlessCanaryDeployments
