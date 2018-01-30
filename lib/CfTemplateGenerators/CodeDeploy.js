function buildApplication(resourceName) {
  return {
    [ resourceName ]: {
      Type: 'AWS::CodeDeploy::Application',
      Properties: { ComputePlatform: 'Lambda' }
    }
  };
}

const CodeDeploy = {
  buildApplication
};

module.exports = CodeDeploy;
