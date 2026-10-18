import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Same format as FAMILY_PASSWORD_HASH is validated against in src/lib/server/authConfig.ts.
const HASH_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{64}$/i;

const USAGE = [
	'Usage:',
	'  node scripts/hash-password.mjs <password>                  print a hash for FAMILY_PASSWORD_HASH',
	'  node scripts/hash-password.mjs --check <password> <hash>   check that a hash matches a password'
].join('\n');

const args = process.argv.slice(2);

if (args[0] === '--check') {
	if (args.length !== 3) {
		console.error(USAGE);
		process.exit(1);
	}
	// Same normalisation as the generator and the login: trim, then NFC.
	const password = args[1].trim();
	const hash = args[2].trim();
	if (!password) {
		console.error(USAGE);
		process.exit(1);
	}
	if (!HASH_PATTERN.test(hash)) {
		console.error('MALFORMED: the hash must look like <32 hex characters>:<64 hex characters>');
		process.exit(2);
	}
	const [salt, key] = hash.split(':');
	const expected = Buffer.from(key, 'hex');
	const actual = scryptSync(password.normalize(), salt, 32);
	if (timingSafeEqual(actual, expected)) {
		console.log('OK: the hash matches that password');
	} else {
		console.error('MISMATCH: the hash does not match that password');
		process.exit(1);
	}
} else {
	const password = args[0]?.trim();
	if (!password) {
		console.error(USAGE);
		process.exit(1);
	}
	const salt = randomBytes(16).toString('hex');
	const key = scryptSync(password.normalize(), salt, 32).toString('hex');
	console.log(`${salt}:${key}`);
}
