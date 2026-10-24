import { describe, expect, it } from 'vitest';
import {
	annotationOf,
	applyAnnotationOverrides,
	applyPatch,
	cleanText,
	fold,
	knownPeople,
	peopleCounts,
	MAX_CAPTION_LENGTH,
	MAX_PEOPLE_LENGTH,
	MAX_PERSON_LENGTH,
	noAnnotation,
	parsePatch,
	patchFromDraft,
	sameAnnotation,
	type Annotation
} from './annotations';

const NOW = 2026;
const note = (caption = '', year: number | null = null, people: string[] = []): Annotation => ({
	caption,
	year,
	people
});

describe('cleanText', () => {
	it('makes one clean line out of anything', () => {
		expect(cleanText('  Boda   de\tAna \n y Luis ')).toBe('Boda de Ana y Luis');
	});

	it('drops control characters', () => {
		expect(cleanText('a\u0000b\u0007c\u007fd')).toBe('a b c d');
	});

	it('leaves accents, ñ and emoji alone', () => {
		expect(cleanText('Cumpleaños de María 😀')).toBe('Cumpleaños de María 😀');
	});
});

describe('fold', () => {
	it('ignores case and accents', () => {
		expect(fold('GARCÍA')).toBe('garcia');
		expect(fold('Muñoz')).toBe('munoz');
	});
});

describe('parsePatch', () => {
	it('refuses anything that is not an object', () => {
		for (const input of [null, undefined, 'x', 3, ['caption']]) {
			expect(parsePatch(input, NOW)).toEqual({ ok: false, problem: 'bad-shape' });
		}
	});

	it('refuses a patch that changes nothing', () => {
		expect(parsePatch({}, NOW)).toEqual({ ok: false, problem: 'nothing-to-change' });
		expect(parsePatch({ addPeople: [], removePeople: ['  '] }, NOW)).toEqual({
			ok: false,
			problem: 'nothing-to-change'
		});
	});

	it('cleans the caption and accepts the longest allowed one', () => {
		expect(parsePatch({ caption: '  Playa \n 1975 ' }, NOW)).toEqual({ ok: true, value: { caption: 'Playa 1975' } });
		const longest = 'x'.repeat(MAX_CAPTION_LENGTH);
		expect(parsePatch({ caption: longest }, NOW)).toEqual({ ok: true, value: { caption: longest } });
		expect(parsePatch({ caption: longest + 'x' }, NOW)).toEqual({ ok: false, problem: 'caption-too-long' });
	});

	it('clears the caption with null or an empty text', () => {
		expect(parsePatch({ caption: null }, NOW)).toEqual({ ok: true, value: { caption: '' } });
		expect(parsePatch({ caption: '   ' }, NOW)).toEqual({ ok: true, value: { caption: '' } });
	});

	it('keeps | and = in a caption (they are escaped when written) but not a backslash', () => {
		expect(parsePatch({ caption: 'a|b=c' }, NOW)).toEqual({ ok: true, value: { caption: 'a|b=c' } });
		expect(parsePatch({ caption: 'a\\b' }, NOW)).toEqual({ ok: false, problem: 'has-backslash' });
	});

	it('only takes a text caption', () => {
		expect(parsePatch({ caption: 5 }, NOW)).toEqual({ ok: false, problem: 'bad-shape' });
	});

	it('accepts a year from 1800 to this year and clears it with null', () => {
		expect(parsePatch({ year: 1800 }, NOW)).toEqual({ ok: true, value: { year: 1800 } });
		expect(parsePatch({ year: NOW }, NOW)).toEqual({ ok: true, value: { year: NOW } });
		expect(parsePatch({ year: null }, NOW)).toEqual({ ok: true, value: { year: null } });
		expect(parsePatch({ year: 1799 }, NOW)).toEqual({ ok: false, problem: 'year-out-of-range' });
		expect(parsePatch({ year: NOW + 1 }, NOW)).toEqual({ ok: false, problem: 'year-out-of-range' });
	});

	it('takes this year from the clock when it is not given', () => {
		expect(parsePatch({ year: new Date().getFullYear() })).toMatchObject({ ok: true });
		expect(parsePatch({ year: new Date().getFullYear() + 1 })).toMatchObject({ ok: false });
	});

	it('only takes a whole number as a year', () => {
		for (const year of ['1975', 1975.5, Number.NaN, true]) {
			expect(parsePatch({ year }, NOW)).toEqual({ ok: false, problem: 'bad-shape' });
		}
	});

	it('cleans the names, drops the empty and repeated ones whatever their case or accents', () => {
		expect(parsePatch({ addPeople: [' Ana  María ', '', 'ana maría', 'Luis'] }, NOW)).toEqual({
			ok: true,
			value: { addPeople: ['Ana María', 'Luis'] }
		});
	});

	it('refuses names that are too long to add, or that have a comma or a backslash', () => {
		expect(parsePatch({ addPeople: ['x'.repeat(MAX_PERSON_LENGTH + 1)] }, NOW)).toEqual({ ok: false, problem: 'person-too-long' });
		expect(parsePatch({ addPeople: ['x'.repeat(MAX_PERSON_LENGTH)] }, NOW)).toMatchObject({ ok: true });
		expect(parsePatch({ addPeople: ['García, Ana'] }, NOW)).toEqual({ ok: false, problem: 'person-has-comma' });
		expect(parsePatch({ removePeople: ['x'.repeat(MAX_PERSON_LENGTH + 20)] }, NOW)).toEqual({
			ok: true,
			value: { removePeople: ['x'.repeat(MAX_PERSON_LENGTH + 20)] }
		});
		expect(parsePatch({ removePeople: ['a\\b'] }, NOW)).toEqual({ ok: false, problem: 'has-backslash' });
	});

	it('wants the people as a list of texts', () => {
		expect(parsePatch({ addPeople: 'Ana' }, NOW)).toEqual({ ok: false, problem: 'bad-shape' });
		expect(parsePatch({ addPeople: [3] }, NOW)).toEqual({ ok: false, problem: 'bad-shape' });
	});

	it('takes every field at once', () => {
		expect(parsePatch({ caption: 'Boda', year: 1980, addPeople: ['Ana'], removePeople: ['Pepe'] }, NOW)).toEqual({
			ok: true,
			value: { caption: 'Boda', year: 1980, addPeople: ['Ana'], removePeople: ['Pepe'] }
		});
	});
});

describe('applyPatch', () => {
	it('replaces the caption and the year, and clears them', () => {
		expect(applyPatch(note('Vieja', 1970), { caption: 'Nueva', year: 1980 })).toEqual({
			ok: true,
			annotation: note('Nueva', 1980)
		});
		expect(applyPatch(note('Vieja', 1970), { caption: '', year: null })).toEqual({ ok: true, annotation: note() });
	});

	it('leaves alone what the patch does not mention', () => {
		expect(applyPatch(note('Vieja', 1970, ['Ana']), { year: 1971 })).toEqual({
			ok: true,
			annotation: note('Vieja', 1971, ['Ana'])
		});
	});

	it('adds people at the end without repeating anyone, whatever the case or accents', () => {
		expect(applyPatch(note('', null, ['Ana', 'Luis']), { addPeople: ['luis', 'María', 'ANA'] })).toEqual({
			ok: true,
			annotation: note('', null, ['Ana', 'Luis', 'María'])
		});
	});

	it('removes people whatever the case or accents, before adding', () => {
		expect(applyPatch(note('', null, ['María', 'Luis']), { removePeople: ['MARÍA'], addPeople: ['Pepe'] })).toEqual({
			ok: true,
			annotation: note('', null, ['Luis', 'Pepe'])
		});
	});

	it('does not touch what it was given', () => {
		const current = note('x', 1970, ['Ana']);
		applyPatch(current, { addPeople: ['Luis'], caption: 'y' });
		expect(current).toEqual(note('x', 1970, ['Ana']));
	});

	it('says so when the people no longer fit in one value', () => {
		const many = Array.from({ length: 40 }, (_, i) => `Persona${String(i).padStart(3, '0')}`);
		expect(many.join(', ').length).toBeGreaterThan(MAX_PEOPLE_LENGTH);
		expect(applyPatch(note(), { addPeople: many })).toEqual({ ok: false, problem: 'too-many-people' });
		expect(applyPatch(note(), { addPeople: many.slice(0, 20) })).toMatchObject({ ok: true });
	});
});

describe('sameAnnotation and annotationOf', () => {
	it('compares caption, year and people in order', () => {
		expect(sameAnnotation(note('a', 1, ['x', 'y']), note('a', 1, ['x', 'y']))).toBe(true);
		expect(sameAnnotation(note('a', 1, ['x', 'y']), note('a', 1, ['y', 'x']))).toBe(false);
		expect(sameAnnotation(note('a', 1), note('a', 2))).toBe(false);
		expect(sameAnnotation(note('a'), note('b'))).toBe(false);
	});

	it('copies, so the people list is not shared', () => {
		const source = note('a', 1, ['x']);
		const copy = annotationOf(source);
		copy.people.push('y');
		expect(source.people).toEqual(['x']);
	});

	it('starts empty', () => {
		expect(noAnnotation()).toEqual({ caption: '', year: null, people: [] });
		expect(noAnnotation().people).not.toBe(noAnnotation().people);
	});
});

describe('patchFromDraft', () => {
	const current = { caption: 'Playa', year: 1975, people: ['Ana', 'Luis'] };
	const same = { caption: 'Playa', year: '1975', people: ['Ana', 'Luis'] };
	const patchOf = (draft: Partial<typeof same>) => patchFromDraft(current, { ...same, ...draft }, NOW);

	it('has nothing to send when the draft says what the photo already has', () => {
		expect(patchOf({})).toEqual({ ok: true, patch: null });
		expect(patchOf({ caption: '  Playa ', year: ' 1975 ', people: [' Ana', 'Luis  '] })).toEqual({ ok: true, patch: null });
		// The same person twice is one person.
		expect(patchOf({ people: ['Ana', 'ana', 'Luis'] })).toEqual({ ok: true, patch: null });
	});

	it('sends the caption when it changes, and an empty one to clear it', () => {
		expect(patchOf({ caption: 'Playa de Sitges' })).toEqual({ ok: true, patch: { caption: 'Playa de Sitges' } });
		expect(patchOf({ caption: '   ' })).toEqual({ ok: true, patch: { caption: '' } });
	});

	it('sends the year when it changes, and null to clear it', () => {
		expect(patchOf({ year: '1980' })).toEqual({ ok: true, patch: { year: 1980 } });
		expect(patchOf({ year: '' })).toEqual({ ok: true, patch: { year: null } });
		expect(patchFromDraft(noAnnotation(), { caption: '', year: '', people: [] }, NOW)).toEqual({ ok: true, patch: null });
	});

	it('sends the people that were added and the ones that were taken off', () => {
		expect(patchOf({ people: ['Ana', 'Marta'] })).toEqual({
			ok: true,
			patch: { addPeople: ['Marta'], removePeople: ['Luis'] }
		});
		expect(patchOf({ people: [] })).toEqual({ ok: true, patch: { removePeople: ['Ana', 'Luis'] } });
	});

	it('sees a name with other accents as another name, which replaces the old one', () => {
		const result = patchFromDraft({ caption: '', year: null, people: ['Maria'] }, { caption: '', year: '', people: ['María'] }, NOW);
		expect(result).toEqual({ ok: true, patch: { addPeople: ['María'], removePeople: ['Maria'] } });
		expect(result.ok && applyPatch(note('', null, ['Maria']), result.patch!)).toEqual({
			ok: true,
			annotation: note('', null, ['María'])
		});
	});

	it('sends everything that changed at once', () => {
		expect(patchOf({ caption: 'Boda', year: '1980', people: ['Ana'] })).toEqual({
			ok: true,
			patch: { caption: 'Boda', year: 1980, removePeople: ['Luis'] }
		});
	});

	it('says which field is wrong', () => {
		expect(patchOf({ year: 'abc' })).toEqual({ ok: false, field: 'year', problem: 'year-out-of-range' });
		expect(patchOf({ year: '75' })).toEqual({ ok: false, field: 'year', problem: 'year-out-of-range' });
		expect(patchOf({ year: '1500' })).toEqual({ ok: false, field: 'year', problem: 'year-out-of-range' });
		expect(patchOf({ year: String(NOW + 1) })).toEqual({ ok: false, field: 'year', problem: 'year-out-of-range' });
		expect(patchOf({ caption: 'x'.repeat(MAX_CAPTION_LENGTH + 1) })).toEqual({ ok: false, field: 'caption', problem: 'caption-too-long' });
		expect(patchOf({ caption: 'a\\b' })).toEqual({ ok: false, field: 'caption', problem: 'has-backslash' });
		expect(patchOf({ people: ['Ana', 'Luis', 'x'.repeat(MAX_PERSON_LENGTH + 1)] })).toEqual({
			ok: false,
			field: 'people',
			problem: 'person-too-long'
		});
	});

	it('reports the caption first when more than one field has a problem', () => {
		expect(patchOf({ caption: 'x'.repeat(256), people: ['x'.repeat(41)] })).toMatchObject({ field: 'caption' });
	});

	it('spells a name that changes only in case as a replacement', () => {
		expect(patchOf({ people: ['ana', 'Luis'] })).toEqual({
			ok: true,
			patch: { addPeople: ['ana'], removePeople: ['Ana'] }
		});
	});

	it('refuses a list of people that does not fit in what Cloudinary keeps', () => {
		const crowd = Array.from({ length: 8 }, (_, i) => `${'N'.repeat(30)}${i}`);
		expect(patchFromDraft(noAnnotation(), { caption: '', year: '', people: crowd }, NOW)).toEqual({
			ok: false,
			field: 'people',
			problem: 'too-many-people'
		});
	});

	it('leaves a year that was already out of range alone when the draft keeps it', () => {
		expect(patchFromDraft({ caption: '', year: 1700, people: [] }, { caption: 'x', year: '1700', people: [] }, NOW)).toEqual({
			ok: true,
			patch: { caption: 'x' }
		});
	});
});

describe('applyAnnotationOverrides', () => {
	const photo = (publicId: string, annotation = note()) => ({ publicId, favorite: false, ...annotation });

	it('is the same array when there is nothing to lay over', () => {
		const photos = [photo('a')];
		expect(applyAnnotationOverrides(photos, new Map())).toBe(photos);
	});

	it('lays the annotation over the photo it is for, and only that one', () => {
		const photos = [photo('a'), photo('b')];
		const result = applyAnnotationOverrides(photos, new Map([['b', note('Playa', 1975, ['Ana'])]]));
		expect(result[0]).toBe(photos[0]);
		expect(result[1]).toEqual({ publicId: 'b', favorite: false, ...note('Playa', 1975, ['Ana']) });
	});

	it('keeps the very same photo when the override says what it already says', () => {
		const photos = [photo('a', note('x', 1, ['y']))];
		expect(applyAnnotationOverrides(photos, new Map([['a', note('x', 1, ['y'])]]))[0]).toBe(photos[0]);
	});
});

describe('knownPeople', () => {
	it('lists each name once, the most used first, then alphabetically', () => {
		const photos = [
			{ people: ['Luis', 'Ana'] },
			{ people: ['Ana', 'Zoe'] },
			{ people: ['Ana', 'Álvaro'] },
			{ people: [] }
		];
		expect(knownPeople(photos)).toEqual(['Ana', 'Álvaro', 'Luis', 'Zoe']);
	});

	it('counts the same name written with another case or accent as one, keeping the first spelling', () => {
		expect(knownPeople([{ people: ['María'] }, { people: ['maria'] }, { people: ['MARÍA'] }])).toEqual(['María']);
	});
});

describe('peopleCounts', () => {
	it('counts the photos each person is in, the most first, merging spellings that fold to the same name', () => {
		const photos = [
			{ people: ['Ana', 'Luis'] },
			{ people: ['ana'] },
			{ people: ['María'] },
			{ people: ['Luis', 'Ana'] }
		];
		expect(peopleCounts(photos)).toEqual([
			{ name: 'Ana', count: 3 },
			{ name: 'Luis', count: 2 },
			{ name: 'María', count: 1 }
		]);
		expect(peopleCounts([])).toEqual([]);
	});
});
