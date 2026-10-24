import { MAX_CAPTION_LENGTH, MAX_PERSON_LENGTH, MIN_YEAR, type PatchProblem } from './annotations';
import { es } from './messages';

/** What to tell a person whose data for a photo (or for many) is not valid, in Spanish. Family area only. */
export function problemText(problem: PatchProblem, currentYear: number = new Date().getFullYear()): string {
	const m = es.notes.problem;
	switch (problem) {
		case 'caption-too-long':
			return m.captionTooLong(MAX_CAPTION_LENGTH);
		case 'has-backslash':
			return m.hasBackslash;
		case 'year-out-of-range':
			return m.year(MIN_YEAR, currentYear);
		case 'person-too-long':
			return m.personTooLong(MAX_PERSON_LENGTH);
		case 'too-many-people':
			return m.tooManyPeople;
		default:
			return m.other;
	}
}
