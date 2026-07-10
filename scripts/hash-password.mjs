import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password) {
	console.error('Usage: node scripts/hash-password.mjs <password>');
	process.exit(1);
}
const salt = randomBytes(16).toString('hex');
const key = scryptSync(password.normalize(), salt, 32).toString('hex');
console.log(`${salt}:${key}`);
