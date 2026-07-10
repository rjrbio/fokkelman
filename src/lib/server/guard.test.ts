import { describe, expect, it } from 'vitest';
import { isPrivatePath } from './guard';

describe('isPrivatePath', () => {
	it('protects the app and the api', () => {
		expect(isPrivatePath('/app')).toBe(true);
		expect(isPrivatePath('/app/photo/family_uploads/x')).toBe(true);
		expect(isPrivatePath('/api/favorite')).toBe(true);
	});

	it('leaves public routes open', () => {
		expect(isPrivatePath('/')).toBe(false);
		expect(isPrivatePath('/demo')).toBe(false);
		expect(isPrivatePath('/login')).toBe(false);
		expect(isPrivatePath('/apple')).toBe(false);
	});
});
