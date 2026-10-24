<script lang="ts">
	import { tick, untrack } from 'svelte';
	import {
		noAnnotation,
		patchFromDraft,
		type DraftField,
		type PatchProblem
	} from '$lib/annotations';
	import { focusTrap } from '$lib/dom';
	import { es } from '$lib/messages';
	import { problemText } from '$lib/problemText';
	import {
		DEFAULT_UPLOAD_FOLDER,
		fileKey,
		runWithLimit,
		splitSelection,
		UPLOAD_CONCURRENCY
	} from '$lib/uploadFiles';
	import PeopleInput from './PeopleInput.svelte';

	interface UploadItem {
		file: File;
		status: 'pending' | 'uploading' | 'done' | 'error';
		progress: number;
	}

	let {
		folder,
		folders,
		suggestions,
		onClose
	}: {
		/** The collection the gallery is showing: where the photos go unless another one is chosen. */
		folder: string;
		/** The collections that exist. */
		folders: string[];
		/** Names already used in the library, most used first. */
		suggestions: string[];
		onClose: (uploadedCount: number) => void;
	} = $props();

	const m = es.upload;

	let items = $state<UploadItem[]>([]);
	let busy = $state(false);
	let notice = $state('');

	// What the new photos are to be called: the same for all of them, and all of it optional.
	// Starts at the collection being looked at; the person can change it, and the gallery moving on does not.
	let chosenFolder = $state(untrack(() => folder || DEFAULT_UPLOAD_FOLDER));
	let caption = $state('');
	let year = $state('');
	// A proxy on purpose: `PeopleInput` adds names with `push`, and only a `$state` array notices that.
	let people = $state<string[]>([]);
	let error = $state<{ field: DraftField; problem: PatchProblem } | null>(null);
	let captionField = $state<HTMLElement>();
	let yearField = $state<HTMLElement>();
	let peopleInput = $state<PeopleInput>();

	const collections = $derived([DEFAULT_UPLOAD_FOLDER, ...folders.filter((name) => name !== DEFAULT_UPLOAD_FOLDER)]);
	const doneCount = $derived(items.filter((i) => i.status === 'done').length);

	function addFiles(files: FileList | null) {
		if (!files) return;
		const { accepted, duplicates, rejected, tooBig } = splitSelection(
			[...files],
			new Set(items.map((item) => fileKey(item.file)))
		);
		for (const file of accepted) items.push({ file, status: 'pending', progress: 0 });
		const skipped = duplicates.length + rejected.length;
		notice = [skipped > 0 ? m.skipped(skipped) : '', tooBig.length > 0 ? m.tooBig(tooBig.length) : '']
			.filter(Boolean)
			.join(' ');
	}

	/** What to tell the server about the photos, or why it cannot be said yet (and the field to go to). */
	async function metadata(): Promise<Record<string, unknown> | null> {
		peopleInput?.commitPending();
		const result = patchFromDraft(noAnnotation(), { caption, year, people });
		if (!result.ok) {
			error = { field: result.field, problem: result.problem };
			notice = m.invalidData;
			await tick();
			({ caption: captionField, year: yearField, people: peopleInput })[result.field]?.focus();
			return null;
		}
		error = null;
		const patch = result.patch;
		return {
			folder: chosenFolder,
			...(patch?.caption ? { caption: patch.caption } : {}),
			...(patch?.year ? { year: patch.year } : {}),
			...(patch?.addPeople ? { people: patch.addPeople } : {})
		};
	}

	async function uploadOne(item: UploadItem, data: Record<string, unknown>) {
		item.status = 'uploading';
		item.progress = 0;
		try {
			const sigRes = await fetch('/api/upload-signature', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			if (!sigRes.ok) throw new Error('signature failed');
			const sig = (await sigRes.json()) as {
				cloudName: string;
				apiKey: string;
				timestamp: number;
				folder: string;
				context?: string;
				signature: string;
			};

			const form = new FormData();
			form.append('file', item.file);
			form.append('api_key', sig.apiKey);
			form.append('timestamp', String(sig.timestamp));
			form.append('signature', sig.signature);
			form.append('folder', sig.folder);
			// Exactly what the server signed: Cloudinary refuses an upload whose context is not the signed one.
			if (sig.context) form.append('context', sig.context);

			await new Promise<void>((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`);
				xhr.upload.onprogress = (e) => {
					if (e.lengthComputable) item.progress = Math.round((e.loaded / e.total) * 100);
				};
				xhr.onload = () =>
					xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`));
				xhr.onerror = () => reject(new Error('network error'));
				xhr.send(form);
			});
			item.status = 'done';
		} catch {
			item.status = 'error';
		}
	}

	async function retry(item: UploadItem) {
		if (busy) return;
		const data = await metadata();
		if (!data) return;
		notice = '';
		// Busy like any other upload: the data stays as it was read, and no second photo goes up beside it.
		busy = true;
		await uploadOne(item, data);
		busy = false;
	}

	async function uploadAll() {
		const data = await metadata();
		if (!data) return;
		busy = true;
		notice = '';
		const waiting = items.filter((i) => i.status === 'pending' || i.status === 'error');
		await runWithLimit(waiting, UPLOAD_CONCURRENCY, (item) => uploadOne(item, data));
		busy = false;
	}

	async function close() {
		if (doneCount > 0) await fetch('/api/refresh-index', { method: 'POST' });
		onClose(doneCount);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !busy) void close();
	}
</script>

<svelte:window {onkeydown} />

<div class="backdrop" role="presentation">
	<div class="modal" role="dialog" aria-modal="true" aria-label={m.title} tabindex="-1" use:focusTrap>
		<h2>{m.title}</h2>

		<label
			class="dropzone"
			ondragover={(e) => e.preventDefault()}
			ondrop={(e) => {
				e.preventDefault();
				addFiles(e.dataTransfer?.files ?? null);
			}}
		>
			{m.dropzone}
			<input
				class="sr-only"
				type="file"
				accept="image/*"
				multiple
				onchange={(e) => {
					addFiles(e.currentTarget.files);
					e.currentTarget.value = '';
				}}
			/>
		</label>
		<!-- Always in the page, so that screen readers announce it when its text changes. -->
		<p class="hint" role="status">{notice}</p>

		{#if items.length > 0}
			<ul>
				{#each items as item (fileKey(item.file))}
					<li>
						<span class="name">{item.file.name}</span>
						{#if item.status === 'uploading'}
							<progress max="100" value={item.progress} aria-label={item.file.name}></progress>
						{:else if item.status === 'done'}
							<span class="ok">{m.done}</span>
						{:else if item.status === 'error'}
							<span class="ko">{m.failed}</span>
							<button class="small" onclick={() => retry(item)} disabled={busy}>{m.retry}</button>
						{:else}
							<span class="dim">{m.waiting}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<fieldset class="data" disabled={busy}>
			<legend>{m.data}</legend>
			<p class="hint">{m.dataHint}</p>

			<div class="form-field">
				<label for="upload-folder">{m.destination}</label>
				<select id="upload-folder" bind:value={chosenFolder}>
					{#each collections as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</select>
			</div>

			<div class="form-field">
				<label for="upload-caption">{es.notes.caption}</label>
				<textarea
					id="upload-caption"
					rows="2"
					bind:this={captionField}
					bind:value={caption}
					aria-invalid={error?.field === 'caption'}
					aria-describedby={error?.field === 'caption' ? 'upload-caption-error' : undefined}
				></textarea>
				{#if error?.field === 'caption'}
					<p class="error" id="upload-caption-error" role="alert">{problemText(error.problem)}</p>
				{/if}
			</div>

			<div class="form-field">
				<label for="upload-year">{es.notes.year}</label>
				<input
					id="upload-year"
					type="text"
					inputmode="numeric"
					autocomplete="off"
					maxlength="4"
					placeholder={es.notes.yearHint}
					bind:this={yearField}
					bind:value={year}
					aria-invalid={error?.field === 'year'}
					aria-describedby={error?.field === 'year' ? 'upload-year-error' : undefined}
				/>
				{#if error?.field === 'year'}
					<p class="error" id="upload-year-error" role="alert">{problemText(error.problem)}</p>
				{/if}
			</div>

			<PeopleInput
				id="upload-person"
				label={es.notes.people}
				bind:this={peopleInput}
				bind:people
				{suggestions}
				hint={es.notes.addPersonHint}
				placeholder={es.notes.addPerson}
				removeLabel={es.notes.removePerson}
				error={error?.field === 'people' ? problemText(error.problem) : undefined}
			/>
		</fieldset>

		<div class="footer">
			<button class="primary" onclick={uploadAll} disabled={busy || items.length === 0}>
				{busy ? m.uploading : m.uploadAll}
			</button>
			<button onclick={close} disabled={busy}>{m.close}</button>
		</div>
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
	}
	.hint {
		margin: 0;
		color: var(--dim);
	}
	/* Out of the grid flow (no stray gap) but still in the accessibility tree, unlike display: none. */
	.hint:empty {
		position: absolute;
	}
	.dropzone {
		padding: 2rem 1rem;
		border: 2px dashed var(--dim);
		border-radius: var(--radius);
		color: var(--dim);
		text-align: center;
		cursor: pointer;
	}
	.dropzone:focus-within {
		border-color: var(--accent);
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	ul {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ok {
		color: var(--accent);
	}
	.ko {
		color: var(--danger);
	}
	.dim {
		color: var(--dim);
	}
	.data {
		display: grid;
		gap: 0.9rem;
		min-width: 0;
		margin: 0;
		padding: 0.9rem 0 0;
		border: none;
		border-top: 1px solid var(--line);
	}
	.data legend {
		padding: 0 0.5rem 0 0;
		font-weight: 600;
	}
	.footer {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
	.footer button,
	.small {
		min-height: 44px;
		padding: 0 1.25rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--chip);
		color: var(--fg);
	}
	.small {
		padding: 0 0.75rem;
	}
	.footer .primary {
		border-color: transparent;
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 600;
	}
	.footer button:disabled,
	.small:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
