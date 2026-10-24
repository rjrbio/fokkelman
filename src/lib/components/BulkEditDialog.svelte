<script lang="ts">
	import { tick } from 'svelte';
	import type { SaveOutcome } from '$lib/annotate.svelte';
	import {
		cleanText,
		parsePatch,
		peopleCounts,
		type AnnotationPatch,
		type PatchProblem
	} from '$lib/annotations';
	import { focusTrap } from '$lib/dom';
	import { es } from '$lib/messages';
	import { problemText } from '$lib/problemText';
	import type { Photo } from '$lib/types';
	import PeopleInput from './PeopleInput.svelte';

	// Family area only: the strings are Spanish and come straight from `es`.
	let {
		mode,
		photos,
		suggestions,
		onApply,
		onClose
	}: {
		/** What is being set for all the photos. */
		mode: 'year' | 'caption' | 'people';
		/** The photos picked, with what they have now. */
		photos: Photo[];
		/** Names already used in the library, most used first. */
		suggestions: string[];
		onApply: (patch: AnnotationPatch, onProgress: (done: number, total: number) => void) => Promise<SaveOutcome>;
		/** `applied` is true when everything was saved. */
		onClose: (applied: boolean) => void;
	} = $props();

	const m = es.bulk;
	const count = $derived(photos.length);

	let year = $state('');
	let caption = $state('');
	// A proxy on purpose: `PeopleInput` adds names with `push`, and only a `$state` array notices that.
	let adding = $state<string[]>([]);
	let removing = $state<string[]>([]);
	/** What is wrong with what was typed, in words. */
	let error = $state<string | null>(null);
	let saving = $state(false);
	let progress = $state<{ done: number; total: number } | null>(null);

	let yearField = $state<HTMLInputElement>();
	let captionField = $state<HTMLTextAreaElement>();
	let peopleInput = $state<PeopleInput>();

	/** The people who are in any of the photos, to offer taking them off. */
	const present = $derived(peopleCounts(photos));

	$effect(() => {
		void tick().then(() => (mode === 'year' ? yearField : mode === 'caption' ? captionField : peopleInput)?.focus());
	});

	function problem(p: PatchProblem): string {
		return problemText(p);
	}

	async function apply(clear: boolean) {
		if (saving) return;
		peopleInput?.commitPending();
		let input: unknown;
		if (mode === 'year') {
			const text = year.trim();
			if (!clear && !/^\d{4}$/.test(text)) {
				error = problem('year-out-of-range');
				return yearField?.focus();
			}
			input = { year: clear ? null : Number(text) };
		} else if (mode === 'caption') {
			if (!clear && cleanText(caption) === '') {
				error = m.caption.empty;
				return captionField?.focus();
			}
			input = { caption: clear ? '' : caption };
		} else {
			input = { addPeople: adding, removePeople: removing };
		}

		const parsed = parsePatch(input);
		if (!parsed.ok) {
			error = parsed.problem === 'nothing-to-change' ? m.people.nothing : problem(parsed.problem);
			return;
		}
		error = null;

		saving = true;
		progress = null;
		const outcome = await onApply(parsed.value, (done, total) => (progress = { done, total }));
		saving = false;
		// When it did not work everything stays as it was, to try again; the page says what went wrong.
		if (outcome === 'done') onClose(true);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || saving) return;
		event.preventDefault();
		onClose(false);
	}

	function toggleRemoved(name: string, on: boolean) {
		removing = on ? [...removing, name] : removing.filter((n) => n !== name);
	}
</script>

<svelte:window {onkeydown} />

<div class="backdrop" role="presentation">
	<div class="modal" role="dialog" aria-modal="true" aria-label={m.title(count)} tabindex="-1" use:focusTrap>
		<h2>{m.title(count)}</h2>

		<form
			onsubmit={(event) => {
				event.preventDefault();
				void apply(false);
			}}
			novalidate
		>
			{#if mode === 'year'}
				<div class="form-field">
					<label for="bulk-year">{m.year.label}</label>
					<input
						id="bulk-year"
						type="text"
						inputmode="numeric"
						autocomplete="off"
						maxlength="4"
						placeholder={m.year.hint}
						bind:this={yearField}
						bind:value={year}
						aria-invalid={error !== null}
						aria-describedby={error !== null ? 'bulk-error' : undefined}
					/>
				</div>
			{:else if mode === 'caption'}
				<div class="form-field">
					<label for="bulk-caption">{m.caption.label}</label>
					<textarea
						id="bulk-caption"
						rows="3"
						bind:this={captionField}
						bind:value={caption}
						aria-invalid={error !== null}
						aria-describedby={error !== null ? 'bulk-error' : undefined}
					></textarea>
				</div>
			{:else}
				<PeopleInput
					id="bulk-person"
					label={m.people.add}
					bind:this={peopleInput}
					bind:people={adding}
					{suggestions}
					hint={m.people.addPersonHint}
					placeholder={m.people.addPerson}
					removeLabel={m.people.removePerson}
				/>
				<fieldset class="form-field">
					<legend>{m.people.remove}</legend>
					{#if present.length === 0}
						<p class="hint">{m.people.nobody}</p>
					{:else}
						{#each present as person (person.name)}
							<label class="check">
								<input
									type="checkbox"
									checked={removing.includes(person.name)}
									onchange={(event) => toggleRemoved(person.name, event.currentTarget.checked)}
								/>
								{m.people.removeOption(person.name, person.count)}
							</label>
						{/each}
					{/if}
				</fieldset>
			{/if}

			{#if error !== null}
				<p class="error" id="bulk-error" role="alert">{error}</p>
			{/if}

			<!-- A progress of its own, in the page all the time so that screen readers announce it when it changes. -->
			<p class="progress" role="status">
				{#if saving}{m.saving} {progress ? m.progress(progress.done, progress.total) : ''}{/if}
			</p>

			<div class="buttons">
				<!-- aria-disabled, not disabled: a disabled button drops the focus, and Esc or Tab would then act on the page behind. -->
				{#if mode === 'people'}
					<button class="button primary" type="submit" aria-disabled={saving}>{m.people.apply(count)}</button>
				{:else}
					<button class="button primary" type="submit" aria-disabled={saving}>
						{mode === 'year' ? m.year.apply(count) : m.caption.apply(count)}
					</button>
					<button class="button" type="button" aria-disabled={saving} onclick={() => apply(true)}>
						{mode === 'year' ? m.year.clear(count) : m.caption.clear(count)}
					</button>
				{/if}
				<button class="button" type="button" aria-disabled={saving} onclick={() => !saving && onClose(false)}>{m.cancel}</button>
			</div>
		</form>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgb(0 0 0 / 0.65);
	}
	.modal {
		display: grid;
		gap: 1rem;
		width: min(100%, 480px);
		max-height: 100%;
		padding: 1.5rem;
		overflow: auto;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--bar);
	}
	h2 {
		margin: 0;
		font-size: 1.15rem;
	}
	form {
		display: grid;
		gap: 1rem;
		min-width: 0;
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: none;
	}
	legend {
		padding: 0;
		margin-bottom: 0.5rem;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 44px;
		color: var(--fg);
	}
	.check input {
		width: 22px;
		height: 22px;
		min-height: 0;
		accent-color: var(--accent);
	}
	.error {
		margin: 0;
		color: var(--danger);
		font-size: 0.9rem;
	}
	.progress {
		margin: 0;
		min-height: 1.4em;
		color: var(--dim);
		font-size: 0.9rem;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.button {
		min-height: 44px;
		padding: 0 1rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--chip);
		color: var(--fg);
		font-weight: 500;
	}
	.button.primary {
		border-color: transparent;
		background: var(--accent);
		color: var(--on-accent);
	}
	.button[aria-disabled='true'] {
		opacity: 0.6;
		cursor: default;
	}
</style>
