'use strict';
module.exports = {
  appId: 'au.edu.sydney.spherail.windows', productName: 'Spherail', copyright: 'Copyright © 2026 rrrome and contributors',
  directories: { output: 'dist', buildResources: 'Assets/Windows' },
  files: ['Windows/**', 'Web/**', 'Assets/Windows/**', 'LICENSE', 'README.md', 'README.en.md', 'THIRD_PARTY_NOTICES.md', 'package.json'],
  asar: true, npmRebuild: false, electronLanguages: ['en-US', 'zh-CN'],
  publish: null,
  win: { target: [{ target: 'nsis', arch: ['x64'] }, { target: 'portable', arch: ['x64'] }, { target: 'zip', arch: ['x64'] }],
    icon: 'Assets/Windows/Spherail.ico', executableName: 'Spherail', signExecutable: false,
    artifactName: 'Spherail-${version}-Windows-${arch}.${ext}' },
  nsis: { artifactName: 'Spherail-${version}-Windows-${arch}-Setup.exe', oneClick: false, perMachine: false,
    allowElevation: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true,
    shortcutName: 'Spherail', license: 'LICENSE', runAfterFinish: false, deleteAppDataOnUninstall: false,
    installerLanguages: ['en_US', 'zh_CN'], displayLanguageSelector: true },
  portable: { artifactName: 'Spherail-${version}-Windows-${arch}-Portable.exe', requestExecutionLevel: 'user' },
};
