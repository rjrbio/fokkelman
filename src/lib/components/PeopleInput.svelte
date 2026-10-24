<script lang="ts">
	import { tick } from 'svelte';
	import { cleanText, fold } from '$lib/annotations';

	// A list of names with a field to add more: the "people" of a photo, in the editor of one photo, in the
	// bulk edit and in the upload. The texts come from the page (this is family-area only, in Spanish).
	let {
		id,
		label,
		people = $bindable(),
		suggestions,
		hint,
		placeholder,
		removeLabel,
		error
	}: {
		/** The id of the text field; the list of suggestions, the hint and the error derive theirs from it. */
		id: string;
		label: string;
		people: string[];
		/** Names already used in the library, most used first. */
		suggestions: string[];
		hint: string;
		placeholder: string;
		removeLabel: (name: string) => string;
		/** What is wrong with the list, when something is. */
		error?: string;
	} = $props();

	/** What has been typed in the field and not added yet. */
	let pending = $state('');
	let root = $state<HTMLElement>();
	let field = $state<HTMLInputElement>();

	const available = $derived(
		suggestions.filter((name) => !people.some((person) => fold(person) === fold(name)))
	);

	/** Adds every name in `text` (a comma separates them) that is not in the list yet, whatever its case or accents. */
	function addPeopleFrom(text: string) {
		for (const piece of text.split(',')) {
			const name = cleanText(piece);
			if (name && !people.some((person) => fold(person) === fold(name))) people.push(name);
		}
	}

	/** Adds what was typed and not added: a name must not be lost because Save was pressed first. */
	export function commitPending() {
		addPeopleFrom(pending);
		pending = '';
	}

	export function focus() {
		field?.focus();
	}

	/** Takes a name off the list and keeps the focus in the field: the button that had it is gone. */
	async function removePerson(name: string) {
		const at = people.indexOf(name);
		people = people.filter((person) => person !== name);
		await tick();
		const buttons = root?.querySelectorAll<HTMLElement>('.chip-remove') ?? [];
		(buttons[Math.min(at, buttons.length - 1)] ?? field)?.focus();
	}

	function onInput(event: Event & { currentTarget: HTMLInputElement }) {
		const value = event.currentTarget.value;
		// Picking a name from the suggestions comes as a replacement, not as typing: it is a name already.
		// Autocorrect and spell checkers also come as replacements: only a name on offer counts as picked.
		const picked =
			(!(event instanceof InputEvent) || event.inputType === 'insertReplacementText') &&
			available.some((name) => fold(name) === fold(cleanText(value)));
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

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || cleanText(pending) === '') return;
		event.preventDefault(); // adds the name; it does not save the form
		commitPending();
	}
</script>

<div class="form-field" bind:this={root}>
	<label for={id}>{label}</label>
	{#if people.length > 0}
		<ul class="chips">
			{#each people as name (name)}
				<li>
					{name}
					<button
						type="button"
						class="chip-remove"
						aria-label={removeLabel(name)}
						onclick={() => removePerson(name)}>×</button
					>
				</li>
			{/each}
		</ul>
	{/if}
	<input
		{id}
		type="text"
		list="{id}-list"
		autocomplete="off"
		autocorrect="off"
		spellcheck="false"
		autocapitalize="words"
		enterkeyhint="done"
		{placeholder}
		bind:this={field}
		value={pending}
		oninput={onInput}
		onkeydown={onKeydown}
		aria-invalid={error !== undefined}
		aria-describedby={error !== undefined ? `${id}-error` : `${id}-hint`}
	/>
	<datalist id="{id}-list">
		{#each available as name (name)}<option value={name}></option>{/each}
	</datalist>
	<p class="hint" id="{id}-hint">{hint}</p>
	{#if error !== undefined}
		<p class="error" id="{id}-error" role="alert">{error}</p>
	{/if}
</div>
