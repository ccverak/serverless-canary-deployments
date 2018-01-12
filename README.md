# Serverless Canary Deployments 

In order to support canary deployments in Serverless, some modifications are needed in the generated Cloud Formation template:

### Global

1. CodeDeployServiceRole
```json
{
  "CodeDeployServiceRole": {
    "Type": "AWS::IAM::Role",
    "Properties": {
      "ManagedPolicyArns": [
        "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRoleForLambda"
      ],
      "AssumeRolePolicyDocument": {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Action": [
              "sts:AssumeRole"
            ],
            "Effect": "Allow",
            "Principal": {
              "Service": [
                "codedeploy.amazonaws.com"
              ]
            }
          }
        ]
      }
    }
  }
}
```

2. CD Deployment Application
```json
{
  "ServerlessDeploymentApplication": {
    "Type": "AWS::CodeDeploy::Application",
    "Properties": {
      "ComputePlatform": "Lambda"
    }
  }
}
```

### Per Function

1. FnDeploymentGroup, depends on CD Deployment App, CD Service Role
```json
{
  "MyFunctionDeploymentGroup": {
    "Type": "AWS::CodeDeploy::DeploymentGroup",
    "Properties": {
      "ApplicationName": {
        "Ref": "ServerlessDeploymentApplication"
      },
      "AutoRollbackConfiguration": {
        "Enabled": true,
        "Events": [
          "DEPLOYMENT_FAILURE",
          "DEPLOYMENT_STOP_ON_ALARM",
          "DEPLOYMENT_STOP_ON_REQUEST"
        ]
      },
      "ServiceRoleArn": {
        "Fn::GetAtt": [
          "CodeDeployServiceRole",
          "Arn"
        ]
      },
      "DeploymentConfigName": {
        "Fn::Sub": [
          "CodeDeployDefault.Lambda${ConfigName}",
          {
            "ConfigName": "Linear10PercentEvery1Minute"
          }
        ]
      },
      "DeploymentStyle": {
        "DeploymentType": "BLUE_GREEN",
        "DeploymentOption": "WITH_TRAFFIC_CONTROL"
      }
    }
  }
}
```

2. FnAliasLive, depends on CD Deployment App, FnDeploymentGroup, Fn Version
```json
{
  "MyFunctionAliaslive": {
    "Type": "AWS::Lambda::Alias",
    "UpdatePolicy": {
      "CodeDeployLambdaAliasUpdate": {
        "ApplicationName": {
          "Ref": "ServerlessDeploymentApplication"
        },
        "AfterAllowTrafficHook": {
          "Ref": "MyOtherFunction"
        },
        "DeploymentGroupName": {
          "Ref": "MyFunctionDeploymentGroup"
        }
      }
    },
    "Properties": {
      "FunctionVersion": {
        "Fn::GetAtt": [ 
          "MyFunctionVersione57c0000de",
          "Version"
        ]
      },
      "FunctionName": {
        "Ref": "MyFunction"
      },
      "Name": "live"
    }
  }
}
```
