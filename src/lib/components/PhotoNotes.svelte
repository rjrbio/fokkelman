<script lang="ts">
	import { tick } from 'svelte';
	import type { SaveOutcome } from '$lib/annotate.svelte';
	import {
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
	import PeopleInput from './PeopleInput.svelte';

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
	let error = $state<{ field: DraftField; problem: PatchProblem } | null>(null);

	let form = $state<HTMLFormElement>();
	let editButton = $state<HTMLElement>();
	let captionField = $state<HTMLElement>();
	let yearField = $state<HTMLElement>();
	let peopleInput = $state<PeopleInput>();

	async function startEditing() {
		caption = photo.caption;
		year = photo.year === null ? '' : String(photo.year);
		people = [...photo.people];
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

	/** Cancel does nothing while a save is in flight (the button is not `disabled`, so it keeps the focus). */
	function cancel() {
		if (saving) return;
		void stopEditing();
	}

	/** Esc leaves the editor, not the viewer: the viewer leaves alone the keys pressed inside a form. */
	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !editing || saving || !form?.contains(event.target as Node)) return;
		event.preventDefault();
		void stopEditing();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (saving) return;
		peopleInput?.commitPending();

		const result = patchFromDraft(photo, { caption, year, people });
		if (!result.ok) {
			error = { field: result.field, problem: result.problem };
			await tick();
			({ caption: captionField, year: yearField, people: peopleInput })[result.field]?.focus();
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
			<div class="form-field">
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

			<div class="form-field">
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

			<PeopleInput
				id="notes-person"
				label={m.people}
				bind:this={peopleInput}
				bind:people
				{suggestions}
				hint={m.addPersonHint}
				placeholder={m.addPerson}
				removeLabel={m.removePerson}
				error={error?.field === 'people' ? problemText(error.problem) : undefined}
			/>

			<div class="buttons">
				<!-- aria-disabled, not disabled: a disabled button drops the focus, and the keys would then act on the viewer. -->
				<button class="button primary" type="submit" aria-disabled={saving}>
					{saving ? m.saving : m.save}
				</button>
				<button class="button" type="button" aria-disabled={saving} onclick={cancel}>{m.cancel}</button>
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
	form {
		display: grid;
		gap: 0.9rem;
		min-width: 0;
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
	.button[aria-disabled='true'] {
		opacity: 0.6;
		cursor: default;
	}
	.notes > .button {
		justify-self: start;
	}
</style>
