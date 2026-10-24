import { beforeEach, describe, expect, it } from 'vitest';
import { clearSelection, selectMany, selected, toggleSelected } from './selection.svelte';

beforeEach(() => clearSelection());

describe('the selection', () => {
	it('picks a photo and, the second time, lets it go', () => {
		toggleSelected('a');
		expect([...selected]).toEqual(['a']);
		toggleSelected('b');
		toggleSelected('a');
		expect([...selected]).toEqual(['b']);
	});

	it('picks many at once without repeating the ones already picked', () => {
		toggleSelected('a');
		selectMany(['a', 'b', 'c', 'b']);
		expect([...selected]).toEqual(['a', 'b', 'c']);
	});

	it('is emptied in one go', () => {
		selectMany(['a', 'b']);
		clearSelection();
		expect(selected.size).toBe(0);
	});
});
