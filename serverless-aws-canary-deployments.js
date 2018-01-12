'use strict'

class AwsCanaryDeployments {
  constructor (serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');
    this.providerNaming = this.provider.naming;
    this.hooks = {
      'before:package:finalize': this.canary.bind(this)
    }
  }

  canary() {
    this.serverless.service.getAllFunctions()
      .map(name => ({ name, obj: this.serverless.service.getFunction(name) }))
      .filter(fn => !!fn.obj.deploymentPreference)
      .forEach((fn) => {
        const normalizedFn = this.providerNaming.getLambdaLogicalId(fn.name);
        const compiled = this.serverless.service.provider.compiledCloudFormationTemplate.Resources[normalizedFn];
        compiled.Properties.DeploymentPreference = fn.obj.deploymentPreference;
      });
  }
}

module.exports = AwsCanaryDeployments
