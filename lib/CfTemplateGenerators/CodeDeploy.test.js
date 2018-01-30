const { expect } = require('chai');
const CodeDeploy = require('./CodeDeploy');

describe('CodeDeploy', () => {
  describe('.buildApplication', () => {
    it('should generate a CodeDeploy::Application resouce', () => {
      const resourceName = 'CodeDeployAppLogicalName';
      const expected = {
        [ resourceName ]: {
          Type: 'AWS::CodeDeploy::Application',
          Properties: { ComputePlatform: 'Lambda' }
        }
      };
      const actual = CodeDeploy.buildApplication(resourceName);
      expect(actual).to.deep.equal(expected);
    });
  });
});
