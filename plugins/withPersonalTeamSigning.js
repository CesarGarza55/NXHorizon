const { IOSConfig, withXcodeProject } = require('expo/config-plugins');

const withPersonalTeamSigning = (config) =>
  withXcodeProject(config, (config) => {
    const project = config.modResults;
    const signableTargets = IOSConfig.Target.findSignableTargets(project);

    for (const [targetId, target] of signableTargets) {
      const buildConfigurations = IOSConfig.XcodeUtils.getBuildConfigurationsForListId(
        project,
        target.buildConfigurationList
      ).filter(([, buildConfiguration]) => buildConfiguration.buildSettings.PRODUCT_NAME);

      for (const [, buildConfiguration] of buildConfigurations) {
        delete buildConfiguration.buildSettings.DEVELOPMENT_TEAM;
        buildConfiguration.buildSettings.CODE_SIGN_STYLE = 'Automatic';
      }

      for (const [, projectSection] of Object.entries(
        IOSConfig.XcodeUtils.getProjectSection(project)
      ).filter(IOSConfig.XcodeUtils.isNotComment)) {
        projectSection.attributes.TargetAttributes ??= {};
        projectSection.attributes.TargetAttributes[targetId] ??= {};
        projectSection.attributes.TargetAttributes[targetId].ProvisioningStyle = 'Automatic';
      }
    }

    return config;
  });

module.exports = withPersonalTeamSigning;
