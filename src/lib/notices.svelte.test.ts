import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissNotice, NOTICE_MS, notice, showNotice } from './notices.svelte';

beforeEach(() => {
	vi.useFakeTimers();
	dismissNotice();
});
afterEach(() => vi.useRealTimers());

describe('notices', () => {
	it('shows a notice and takes it down by itself', () => {
		showNotice('Enlace copiado');
		expect(notice.text).toBe('Enlace copiado');
		vi.advanceTimersByTime(NOTICE_MS);
		expect(notice.text).toBe('');
	});

	it('gives a newer notice its full time, not what was left of the older one', () => {
		showNotice('uno');
		vi.advanceTimersByTime(NOTICE_MS - 100);
		showNotice('dos');
		vi.advanceTimersByTime(NOTICE_MS - 100);
		expect(notice.text).toBe('dos');
		vi.advanceTimersByTime(100);
		expect(notice.text).toBe('');
	});
});
