import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (process.platform !== 'win32') throw new Error('Build Windows releases on Windows.');
const metadata = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const macVersion = fs.readFileSync('AppInfo.plist', 'utf8').match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
if (metadata.version !== macVersion) throw new Error(`Windows ${metadata.version} must match macOS ${macVersion}.`);
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with ${result.status}`);
}
run(process.execPath, ['scripts/build_3d.mjs']);
run(process.execPath, ['scripts/runtime_licenses.mjs']);
const localPython = path.join(root, '.venv', 'Scripts', 'python.exe');
run(process.env.INKBALL_BUILD_PYTHON || (fs.existsSync(localPython) ? localPython : 'python'), ['scripts/prepare_windows_icon.py']);
run(process.execPath, ['node_modules/electron-builder/out/cli/cli.js', '--config', 'electron-builder.cjs', '--win', '--x64', '--publish', 'never']);
