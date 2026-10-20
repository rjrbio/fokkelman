<script lang="ts">
	import { tick } from 'svelte';
	import type { SaveOutcome } from '$lib/annotate.svelte';
	import {
		cleanText,
		fold,
		MAX_CAPTION_LENGTH,
		MAX_PERSON_LENGTH,
		MIN_YEAR,
		patchFromDraft,
		type AnnotationPatch,
		type DraftField,
		type PatchProblem
	} from '$lib/annotations';
	import { es } from '$lib/messages';
	import type { Photo } from '$lib/types';

	// Family area only: the strings are Spanish and come straight from `es`.
	let {
		photo,
		suggestions,
		onSave
	}: {
		photo: Photo;
		/** Names already used in the library, most used first. */
		suggestions: string[];
		onSave: (patch: AnnotationPatch) => Promise<SaveOutcome>;
	} = $props();

	const m = es.notes;

	let editing = $state(false);
	let saving = $state(false);
	let caption = $state('');
	let year = $state('');
	let people = $state<string[]>([]);
	/** What has been typed in the person field and not added yet. */
	let pending = $state('');
	let error = $state<{ field: DraftField; problem: PatchProblem } | null>(null);

	let form = $state<HTMLFormElement>();
	let editButton = $state<HTMLElement>();
	let captionField = $state<HTMLElement>();
	let yearField = $state<HTMLElement>();
	let personField = $state<HTMLElement>();

	const available = $derived(
		suggestions.filter((name) => !people.some((person) => fold(person) === fold(name)))
	);

	async function startEditing() {
		caption = photo.caption;
		year = photo.year === null ? '' : String(photo.year);
		people = [...photo.people];
		pending = '';
		error = null;
		editing = true;
		await tick();
		captionField?.focus();
	}

	async function stopEditing() {
		editing = false;
		await tick();
		editButton?.focus();
	}

	/** Adds every name in `text` (a comma separates them) that is not in the list yet, whatever its case or accents. */
	function addPeopleFrom(text: string) {
		for (const piece of text.split(',')) {
			const name = cleanText(piece);
			if (name && !people.some((person) => fold(person) === fold(name))) people.push(name);
		}
	}

	function onPersonInput(event: Event & { currentTarget: HTMLInputElement }) {
		const value = event.currentTarget.value;
		// Picking a name from the suggestions comes as a replacement, not as typing: it is a name already.
		const picked = !(event instanceof InputEvent) || event.inputType === 'insertReplacementText';
		if (picked) {
			addPeopleFrom(value);
			pending = '';
		} else if (value.includes(',')) {
			const cut = value.lastIndexOf(',');
			addPeopleFrom(value.slice(0, cut));
			pending = value.slice(cut + 1);
		} else {
			pending = value;
		}
		event.currentTarget.value = pending;
	}

	function onPersonKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || cleanText(pending) === '') return;
		event.preventDefault(); // adds the name; it does not save the form
		addPeopleFrom(pending);
		pending = '';
	}

	/** Esc leaves the editor, not the viewer: the viewer leaves alone the keys pressed inside a form. */
	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !editing || !form?.contains(event.target as Node)) return;
		event.preventDefault();
		void stopEditing();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (saving) return;
		addPeopleFrom(pending);
		pending = '';

		const result = patchFromDraft(photo, { caption, year, people });
		if (!result.ok) {
			error = { field: result.field, problem: result.problem };
			await tick();
			({ caption: captionField, year: yearField, people: personField })[result.field]?.focus();
			return;
		}
		error = null;
		if (result.patch === null) return stopEditing();

		saving = true;
		const outcome = await onSave(result.patch);
		saving = false;
		// When it did not work the form stays as it was, to try again; the page says what went wrong.
		if (outcome === 'done') await stopEditing();
	}

	function problemText(problem: PatchProblem): string {
		switch (problem) {
			case 'caption-too-long':
				return m.problem.captionTooLong(MAX_CAPTION_LENGTH);
			case 'has-backslash':
				return m.problem.hasBackslash;
			case 'year-out-of-range':
				return m.problem.year(MIN_YEAR, new Date().getFullYear());
			case 'person-too-long':
				return m.problem.personTooLong(MAX_PERSON_LENGTH);
			case 'too-many-people':
				return m.problem.tooManyPeople;
			default:
				return m.problem.other;
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<section class="notes" aria-labelledby="notes-heading">
	<h3 id="notes-heading" class="sr-only">{m.heading}</h3>

	{#if !editing}
		<dl>
			<dt>{m.caption}</dt>
			<dd class:empty={!photo.caption}>{photo.caption || m.noCaption}</dd>
			<dt>{m.year}</dt>
			<dd class:empty={photo.year === null}>{photo.year ?? m.noYear}</dd>
			<dt>{m.people}</dt>
			<dd class:empty={photo.people.length === 0}>
				{#if photo.people.length > 0}
					<ul class="chips">
						{#each photo.people as name (name)}<li>{name}</li>{/each}
					</ul>
				{:else}
					{m.noPeople}
				{/if}
			</dd>
		</dl>
		<button class="button" bind:this={editButton} onclick={startEditing}>{m.edit}</button>
	{:else}
		<form bind:this={form} onsubmit={submit} novalidate>
			<div class="field">
				<label for="notes-caption">{m.caption}</label>
				<textarea
					id="notes-caption"
					rows="3"
					bind:this={captionField}
					bind:value={caption}
					aria-invalid={error?.field === 'caption'}
					aria-describedby={error?.field === 'caption' ? 'notes-caption-error' : undefined}
				></textarea>
				{#if error?.field === 'caption'}
					<p class="error" id="notes-caption-error" role="alert">{problemText(error.problem)}</p>
				{/if}
			</div>

			<div class="field">
				<label for="notes-year">{m.year}</label>
				<input
					id="notes-year"
					type="text"
					inputmode="numeric"
					autocomplete="off"
					maxlength="4"
					placeholder={m.yearHint}
					bind:this={yearField}
					bind:value={year}
					aria-invalid={error?.field === 'year'}
					aria-describedby={error?.field === 'year' ? 'notes-year-error' : undefined}
				/>
				{#if error?.field === 'year'}
					<p class="error" id="notes-year-error" role="alert">{problemText(error.problem)}</p>
				{/if}
			</div>

			<div class="field">
				<label for="notes-person">{m.people}</label>
				{#if people.length > 0}
					<ul class="chips">
						{#each people as name (name)}
							<li>
								{name}
								<button
									type="button"
									class="remove"
									aria-label={m.removePerson(name)}
									onclick={() => (people = people.filter((person) => person !== name))}>×</button
								>
							</li>
						{/each}
					</ul>
				{/if}
				<input
					id="notes-person"
					type="text"
					list="notes-people"
					autocomplete="off"
					enterkeyhint="done"
					placeholder={m.addPerson}
					bind:this={personField}
					value={pending}
					oninput={onPersonInput}
					onkeydown={onPersonKeydown}
					aria-invalid={error?.field === 'people'}
					aria-describedby={error?.field === 'people' ? 'notes-person-error' : 'notes-person-hint'}
				/>
				<datalist id="notes-people">
					{#each available as name (name)}<option value={name}></option>{/each}
				</datalist>
				<p class="hint" id="notes-person-hint">{m.addPersonHint}</p>
				{#if error?.field === 'people'}
					<p class="error" id="notes-person-error" role="alert">{problemText(error.problem)}</p>
				{/if}
			</div>

			<div class="buttons">
				<button class="button primary" type="submit" disabled={saving}>
					{saving ? m.saving : m.save}
				</button>
				<button class="button" type="button" disabled={saving} onclick={stopEditing}>{m.cancel}</button>
			</div>
		</form>
	{/if}
</section>

<style>
	.notes {
		display: grid;
		gap: 0.75rem;
		min-width: 0;
	}
	dl {
		display: grid;
		grid-template-columns: 5.5rem 1fr;
		gap: 0.5rem 1rem;
		margin: 0;
		font-size: 0.9rem;
	}
	dt {
		color: var(--dim);
	}
	dd {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	dd.empty {
		color: var(--dim);
	}
	form,
	.field {
		display: grid;
		gap: 0.5rem;
		min-width: 0;
	}
	form {
		gap: 0.9rem;
	}
	label {
		font-size: 0.9rem;
		color: var(--dim);
	}
	textarea,
	input {
		width: 100%;
		min-height: 44px;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--chip);
		color: var(--fg);
	}
	textarea {
		resize: vertical;
	}
	[aria-invalid='true'] {
		border-color: var(--danger);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chips li {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-height: 32px;
		padding: 0 0.7rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--chip);
		font-size: 0.9rem;
	}
	.remove {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		margin-right: -0.5rem;
		border: none;
		border-radius: 999px;
		background: none;
		color: var(--dim);
		font-size: 1.1rem;
		line-height: 1;
	}
	.hint,
	.error {
		margin: 0;
		font-size: 0.85rem;
	}
	.hint {
		color: var(--dim);
	}
	.error {
		color: var(--danger);
	}
	.buttons {
		display: flex;
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
	.button:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.notes > .button {
		justify-self: start;
	}
</style>
