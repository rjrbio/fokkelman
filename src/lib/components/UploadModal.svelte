<script lang="ts">
	import { focusTrap } from '$lib/dom';
	import { es } from '$lib/messages';
	import { fileKey, splitSelection } from '$lib/uploadFiles';

	interface UploadItem {
		file: File;
		status: 'pending' | 'uploading' | 'done' | 'error';
		progress: number;
	}

	let { folder, onClose }: { folder: string; onClose: (uploadedCount: number) => void } = $props();

	const m = es.upload;

	let items = $state<UploadItem[]>([]);
	let busy = $state(false);
	let notice = $state('');

	const doneCount = $derived(items.filter((i) => i.status === 'done').length);

	function addFiles(files: FileList | null) {
		if (!files) return;
		const { accepted, duplicates, rejected } = splitSelection(
			[...files],
			new Set(items.map((item) => fileKey(item.file)))
		);
		for (const file of accepted) items.push({ file, status: 'pending', progress: 0 });
		const skipped = duplicates.length + rejected.length;
		notice = skipped > 0 ? m.skipped(skipped) : '';
	}

	async function uploadOne(item: UploadItem) {
		item.status = 'uploading';
		item.progress = 0;
		try {
			const sigRes = await fetch('/api/upload-signature', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ folder })
			});
			if (!sigRes.ok) throw new Error('signature failed');
			const sig = (await sigRes.json()) as {
				cloudName: string;
				apiKey: string;
				timestamp: number;
				folder: string;
				signature: string;
			};

			const form = new FormData();
			form.append('file', item.file);
			form.append('api_key', sig.apiKey);
			form.append('timestamp', String(sig.timestamp));
			form.append('signature', sig.signature);
			form.append('folder', sig.folder);

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

	async function uploadAll() {
		busy = true;
		for (const item of items) {
			if (item.status === 'pending' || item.status === 'error') await uploadOne(item);
		}
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
		<p class="hint">{m.destination} <strong>{folder || 'family_uploads'}</strong></p>

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
							<button class="small" onclick={() => uploadOne(item)}>{m.retry}</button>
						{:else}
							<span class="dim">{m.waiting}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

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
	.footer button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
