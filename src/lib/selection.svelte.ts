import { SvelteSet } from 'svelte/reactivity';

// Browser only: never call from server code (module state is shared across requests).

/** The photos picked in this session to do something to all of them at once. Read it inside a template/`$derived`. */
export const selected = new SvelteSet<string>();

export function toggleSelected(publicId: string): void {
	if (!selected.delete(publicId)) selected.add(publicId);
}

export function selectMany(publicIds: Iterable<string>): void {
	for (const publicId of publicIds) selected.add(publicId);
}

export const clearSelection = (): void => selected.clear();
