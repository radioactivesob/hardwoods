const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withCppStandard(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (!contents.includes('FMT_CONSTEVAL patch')) {
        // Patch the fmt headers after pod install to remove consteval.
        // fmt bundled with RN 0.81.x uses consteval in a way that Clang 16+
        // rejects. Replacing the definition with an empty token fixes it.
        const injection = [
          '    # FMT_CONSTEVAL patch — remove consteval from fmt for Clang 16+ compatibility',
          '    Dir.glob("#{installer.sandbox.root}/fmt/include/fmt/*.h").each do |file|',
          '      content = File.read(file)',
          "      patched = content.gsub('define FMT_CONSTEVAL consteval', 'define FMT_CONSTEVAL ')",
          '      File.write(file, patched) if patched != content',
          '    end',
        ].join('\n');

        contents = contents.replace('\n  end\nend\n', `\n${injection}\n  end\nend\n`);
        fs.writeFileSync(podfilePath, contents);
      }

      return config;
    },
  ]);
};
