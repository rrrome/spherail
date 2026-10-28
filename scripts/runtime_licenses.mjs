import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)), seen = new Set(), entries = [];
function visit(name, from = root) {
  let parent = from, directory;
  while (true) {
    const candidate = path.join(parent, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) { directory = candidate; break; }
    const next = path.dirname(parent); if (next === parent) throw new Error(`Cannot resolve runtime license: ${name}`); parent = next;
  }
  if (seen.has(directory)) return; seen.add(directory);
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const notices = fs.readdirSync(directory).filter(file => /^(licen[cs]e|copying|notice)(\.|$)/i.test(file) && fs.statSync(path.join(directory, file)).isFile());
  if (!notices.length) throw new Error(`No license file found for ${name}`);
  entries.push(`\n${'='.repeat(72)}\n${name} ${metadata.version} — ${metadata.license}\n` + notices.map(file => fs.readFileSync(path.join(directory, file), 'utf8')).join('\n'));
  for (const dependency of Object.keys(metadata.dependencies ?? {})) visit(dependency, directory);
}
for (const name of Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies)) visit(name);
fs.writeFileSync(path.join(root, 'Windows/DEPENDENCY_LICENSES.txt'), 'Windows runtime dependency licenses\n' + entries.join('\n'));
console.log(`Collected ${seen.size} runtime dependency licenses.`);
