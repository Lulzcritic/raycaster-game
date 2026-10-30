import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.resolve(__dirname, '../package.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const currentVersion = pkg.version || '0.1.0';
const parts = currentVersion.split('.');
const major = parseInt(parts[0] || '0', 10);
const minor = parseInt(parts[1] || '1', 10);
const patch = parseInt(parts[2] || '0', 10) + 1;

const newVersion = `${major}.${minor}.${patch}`;
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log(`✅ Version incrémentée : ${currentVersion} -> ${newVersion} (+0.0.1)`);
