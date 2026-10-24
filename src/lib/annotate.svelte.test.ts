import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ANNOTATION_FAILURE_MS,
	annotationFailure,
	clearAnnotationOverrides,
	dismissAnnotationFailure,
	saveAnnotation,
	saveAnnotationInBatches,
	withAnnotationOverrides
} from './annotate.svelte';
import { noAnnotation } from './annotations';
import type { Photo } from './types';

const photo = (publicId: string, fields: Partial<Photo> = {}): Photo => ({
	publicId,
	folder: '',
	format: 'jpg',
	width: 1,
	height: 1,
	favorite: false,
	...noAnnotation(),
	...fields
});

const answer = (body: unknown, status = 200) => () => Promise.resolve(Response.json(body, { status }));
const status = (code: number) => () => Promise.resolve(new Response(null, { status: code }));
const annotationOf = (id: string, base: Photo[]) => {
	const { caption, year, people } = withAnnotationOverrides(base).find((p) => p.publicId === id)!;
	return { caption, year, people };
};

beforeEach(() => {
	vi.useFakeTimers();
	clearAnnotationOverrides();
	dismissAnnotationFailure();
});
afterEach(() => vi.useRealTimers());

describe('saveAnnotation', () => {
	it('shows the change before the server answers and keeps what the server answers with', async () => {
		const base = [photo('a', { people: ['Ana'] })];
		let release!: (r: Response) => void;
		const send = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));

		const pending = saveAnnotation(base, { caption: 'Playa', addPeople: ['Luis'] }, send);
		expect(annotationOf('a', base)).toEqual({ caption: 'Playa', year: null, people: ['Ana', 'Luis'] });
		// Somebody else added Marta in the meantime: the server's merge is the truth.
		release(Response.json({ updated: [{ publicId: 'a', annotation: { caption: 'Playa', year: null, people: ['Ana', 'Marta', 'Luis'] } }], failed: [] }));

		expect(await pending).toBe('done');
		expect(send).toHaveBeenCalledWith(['a'], { caption: 'Playa', addPeople: ['Luis'] });
		expect(annotationOf('a', base).people).toEqual(['Ana', 'Marta', 'Luis']);
	});

	it('does not ask the server for photos the patch leaves as they are', async () => {
		const base = [photo('a', { caption: 'Playa' }), photo('b')];
		const send = vi.fn(answer({ updated: [], failed: [] }));

		await saveAnnotation(base, { caption: 'Playa' }, send);

		expect(send).toHaveBeenCalledWith(['b'], { caption: 'Playa' });
	});

	it('does not ask at all when nothing changes', async () => {
		const send = vi.fn(answer({}));
		expect(await saveAnnotation([photo('a', { year: 1975 })], { year: 1975 }, send)).toBe('done');
		expect(send).not.toHaveBeenCalled();
	});

	it('takes the change back and says so when the server fails', async () => {
		const base = [photo('a', { caption: 'Vieja' })];
		expect(await saveAnnotation(base, { caption: 'Nueva' }, status(500))).toBe('failed');
		expect(annotationOf('a', base).caption).toBe('Vieja');
		expect(withAnnotationOverrides(base)).toBe(base); // nothing left over
		expect(annotationFailure).toEqual({ problem: 'failed', count: 1 });
	});

	it('takes the change back with the usual notice when the server cannot read the photos (503, a problem the browser does not know)', async () => {
		const base = [photo('a', { caption: 'Vieja' })];
		const unavailable = answer({ message: 'Could not read the current photo data', problem: 'unavailable' }, 503);
		expect(await saveAnnotation(base, { caption: 'Nueva' }, unavailable)).toBe('failed');
		expect(annotationOf('a', base).caption).toBe('Vieja');
		expect(annotationFailure).toEqual({ problem: 'failed', count: 1 });
	});

	it('takes the change back when the network fails', async () => {
		const base = [photo('a')];
		expect(await saveAnnotation(base, { year: 1975 }, () => Promise.reject(new Error('offline')))).toBe('failed');
		expect(annotationOf('a', base).year).toBeNull();
	});

	it('takes it back quietly and reports an expired session on 401', async () => {
		const base = [photo('a')];
		expect(await saveAnnotation(base, { year: 1975 }, status(401))).toBe('unauthorized');
		expect(annotationOf('a', base).year).toBeNull();
		expect(annotationFailure.problem).toBeNull();
	});

	it('passes on why the server refused when it says so', async () => {
		const base = [photo('a')];
		await saveAnnotation(base, { addPeople: ['Ana'] }, answer({ problem: 'too-many-people' }, 422));
		expect(annotationFailure.problem).toBe('too-many-people');
		expect(annotationOf('a', base).people).toEqual([]);
	});

	it('does not even ask when the patch cannot be applied here', async () => {
		const base = [photo('a', { people: Array.from({ length: 7 }, (_, i) => `${'N'.repeat(30)}${i}`) })];
		const send = vi.fn();
		expect(await saveAnnotation(base, { addPeople: ['M'.repeat(30)] }, send)).toBe('failed');
		expect(send).not.toHaveBeenCalled();
		expect(annotationFailure.problem).toBe('too-many-people');
	});

	it('keeps what was saved and takes back only the photos the server says failed', async () => {
		const base = [photo('a'), photo('b')];
		await saveAnnotation(
			base,
			{ caption: 'x' },
			answer({
				updated: [{ publicId: 'a', annotation: { caption: 'x', year: null, people: [] } }],
				failed: ['b']
			})
		);
		expect(annotationOf('a', base).caption).toBe('x');
		expect(annotationOf('b', base).caption).toBe('');
		expect(annotationFailure).toEqual({ problem: 'failed', count: 1 });
	});

	it('goes back to the earlier unsaved change, not to the server data, when a later save fails', async () => {
		const base = [photo('a')];
		await saveAnnotation(base, { caption: 'Primera' }, answer({ updated: [], failed: [] }));
		await saveAnnotation(base, { caption: 'Segunda' }, status(500));
		expect(annotationOf('a', base).caption).toBe('Primera');
	});

	it('ignores a second save of a photo while the first is in flight', async () => {
		const base = [photo('a')];
		let release!: (r: Response) => void;
		const send = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));

		const first = saveAnnotation(base, { caption: 'x' }, send);
		expect(await saveAnnotation(base, { caption: 'y' }, send)).toBe('busy');
		release(Response.json({ updated: [], failed: [] }));
		await first;

		expect(send).toHaveBeenCalledTimes(1);
		expect(annotationOf('a', base).caption).toBe('x');
		expect(await saveAnnotation(base, { caption: 'z' }, answer({ updated: [], failed: [] }))).toBe('done');
	});

	it('dismisses the failure by itself, and when a new save starts', async () => {
		const base = [photo('a')];
		await saveAnnotation(base, { year: 1975 }, status(500));
		expect(annotationFailure.problem).toBe('failed');
		vi.advanceTimersByTime(ANNOTATION_FAILURE_MS);
		expect(annotationFailure.problem).toBeNull();

		await saveAnnotation(base, { year: 1975 }, status(500));
		await saveAnnotation(base, { year: 1976 }, answer({ updated: [], failed: [] }));
		expect(annotationFailure.problem).toBeNull();
	});

	it('forgets everything when the server data arrives', async () => {
		const base = [photo('a')];
		await saveAnnotation(base, { caption: 'x' }, answer({ updated: [], failed: [] }));
		clearAnnotationOverrides();
		expect(withAnnotationOverrides(base)).toBe(base);
	});
});

describe('saveAnnotationInBatches', () => {
	const crowd = (n: number) => Array.from({ length: n }, (_, i) => photo(`p${i}`));
	const ok = (ids: string[]) => Response.json({ updated: ids.map((publicId) => ({ publicId, annotation: { caption: 'x', year: null, people: [] } })), failed: [] });

	it('sends the photos 200 at a time, one request after another, and says how far it got', async () => {
		const sent: number[] = [];
		const send = vi.fn(async (ids: string[]) => {
			sent.push(ids.length);
			return ok(ids);
		});
		const progress: [number, number][] = [];

		const outcome = await saveAnnotationInBatches(crowd(450), { caption: 'x' }, send, (done, total) => progress.push([done, total]));

		expect(outcome).toBe('done');
		expect(sent).toEqual([200, 200, 50]);
		expect(progress).toEqual([[200, 450], [400, 450], [450, 450]]);
		expect(annotationOf('p449', crowd(450)).caption).toBe('x');
	});

	it('tells the failures of all the groups once, with the total, and keeps what was saved', async () => {
		let call = 0;
		const send = async (ids: string[]) => (++call === 2 ? new Response(null, { status: 500 }) : ok(ids));
		const base = crowd(450);

		const outcome = await saveAnnotationInBatches(base, { caption: 'x' }, send);

		expect(outcome).toBe('failed');
		expect(annotationFailure).toEqual({ problem: 'failed', count: 200 });
		expect(annotationOf('p0', base).caption).toBe('x'); // first group, saved
		expect(annotationOf('p250', base).caption).toBe(''); // second group, taken back
		expect(annotationOf('p449', base).caption).toBe('x'); // third group, saved
	});

	it('adds up the photos of every group that failed', async () => {
		let call = 0;
		const send = async (ids: string[]) => (++call === 2 ? ok(ids) : new Response(null, { status: 500 }));

		await saveAnnotationInBatches(crowd(450), { caption: 'x' }, send);

		expect(annotationFailure).toEqual({ problem: 'failed', count: 250 }); // 200 + 50
	});

	it('stops when the session has expired, keeping what was saved before', async () => {
		let call = 0;
		const send = vi.fn(async (ids: string[]) => (++call === 2 ? new Response(null, { status: 401 }) : ok(ids)));
		const base = crowd(450);

		expect(await saveAnnotationInBatches(base, { caption: 'x' }, send)).toBe('unauthorized');

		expect(send).toHaveBeenCalledTimes(2);
		expect(annotationOf('p0', base).caption).toBe('x');
		expect(annotationOf('p250', base).caption).toBe('');
		expect(annotationFailure.problem).toBeNull();
	});

	it('does nothing for a photo that has a save in flight', async () => {
		const base = crowd(3);
		let release!: (r: Response) => void;
		const slow = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));
		const first = saveAnnotation([base[0]], { caption: 'a' }, slow);

		expect(await saveAnnotationInBatches(base, { caption: 'x' }, vi.fn())).toBe('busy');

		release(Response.json({ updated: [], failed: [] }));
		await first;
	});

	it('asks nothing when no photo changes, and does not report progress for nothing', async () => {
		const send = vi.fn();
		expect(await saveAnnotationInBatches([], { caption: 'x' }, send)).toBe('done');
		expect(send).not.toHaveBeenCalled();
	});
});
