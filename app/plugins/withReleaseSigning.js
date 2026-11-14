// Signs release builds with the key in the TMO_KEYSTORE_* environment variables
// (set from GitHub Actions secrets). Using the same key every time lets new APKs
// install over old ones without losing settings or downloaded data.
// If the variables are missing the build falls back to Expo's debug signing.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// tmo-release-signing";

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    cfg.modResults.contents += `
${MARKER}
if (System.getenv("TMO_KEYSTORE_FILE")) {
    android {
        signingConfigs {
            tmoRelease {
                storeFile file(System.getenv("TMO_KEYSTORE_FILE"))
                storePassword System.getenv("TMO_KEYSTORE_PASSWORD")
                keyAlias System.getenv("TMO_KEY_ALIAS")
                keyPassword System.getenv("TMO_KEY_PASSWORD")
            }
        }
        buildTypes {
            release {
                signingConfig signingConfigs.tmoRelease
            }
        }
    }
}
`;
    return cfg;
  });
};
