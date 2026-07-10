import { describe, expect, it } from 'vitest';
import { getDemoFavorites, toggleDemoFavorite } from './demoFavorites';

function fakeStorage(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
	return {
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v)
	};
}

describe('demo favorites', () => {
	it('starts empty', () => {
		expect(getDemoFavorites(fakeStorage()).size).toBe(0);
	});

	it('toggles a favorite on and off, persisting to storage', () => {
		const storage = fakeStorage();
		expect(toggleDemoFavorite('demo/cat', storage).has('demo/cat')).toBe(true);
		expect(getDemoFavorites(storage).has('demo/cat')).toBe(true);
		expect(toggleDemoFavorite('demo/cat', storage).has('demo/cat')).toBe(false);
	});

	it('survives corrupted storage content', () => {
		const storage = fakeStorage({ demo_favorites: 'not json{{' });
		expect(getDemoFavorites(storage).size).toBe(0);
	});
});
