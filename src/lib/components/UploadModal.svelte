<script lang="ts">
	interface UploadItem {
		file: File;
		status: 'pending' | 'uploading' | 'done' | 'error';
		progress: number;
	}

	let { folder, onClose }: { folder: string; onClose: (uploadedCount: number) => void } = $props();

	let items = $state<UploadItem[]>([]);
	let busy = $state(false);

	const doneCount = $derived(items.filter((i) => i.status === 'done').length);

	function addFiles(files: FileList | null) {
		if (!files) return;
		for (const file of files) {
			if (file.type.startsWith('image/')) items.push({ file, status: 'pending', progress: 0 });
		}
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
</script>

<div class="backdrop" role="dialog" aria-modal="true" aria-label="Upload photos">
	<div class="modal">
		<h2>Upload photos</h2>
		<p class="hint">Destination: <strong>{folder || 'family_uploads'}</strong></p>

		<label
			class="dropzone"
			ondragover={(e) => e.preventDefault()}
			ondrop={(e) => {
				e.preventDefault();
				addFiles(e.dataTransfer?.files ?? null);
			}}
		>
			Drag photos here or click to choose
			<input
				type="file"
				accept="image/*"
				multiple
				onchange={(e) => addFiles(e.currentTarget.files)}
			/>
		</label>

		{#if items.length > 0}
			<ul>
				{#each items as item (item.file.name + item.file.size)}
					<li>
						<span class="name">{item.file.name}</span>
						{#if item.status === 'uploading'}
							<progress max="100" value={item.progress}></progress>
						{:else if item.status === 'done'}
							<span class="ok">Done</span>
						{:else if item.status === 'error'}
							<span class="ko">Failed</span>
							<button onclick={() => uploadOne(item)}>Retry</button>
						{:else}
							<span class="dim">Waiting</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<footer>
			<button class="primary" onclick={uploadAll} disabled={busy || items.length === 0}>
				{busy ? 'Uploading…' : 'Upload all'}
			</button>
			<button onclick={close} disabled={busy}>Close</button>
		</footer>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: rgb(0 0 0 / 0.5);
		display: grid;
		place-items: center;
	}
	.modal {
		background: var(--bg);
		border-radius: var(--radius);
		padding: 1.5rem;
		width: min(92vw, 480px);
		max-height: 85vh;
		overflow: auto;
		display: grid;
		gap: 1rem;
	}
	h2 {
		margin: 0;
	}
	.hint {
		margin: 0;
		color: var(--text-dim);
	}
	.dropzone {
		border: 2px dashed var(--text-dim);
		border-radius: var(--radius);
		padding: 2rem;
		text-align: center;
		color: var(--text-dim);
		cursor: pointer;
	}
	.dropzone input {
		display: none;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
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
		color: #188038;
	}
	.ko {
		color: var(--danger);
	}
	.dim {
		color: var(--text-dim);
	}
	footer {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
	footer button {
		padding: 0.6rem 1.2rem;
		border-radius: var(--radius);
		border: 1px solid var(--surface);
		background: var(--bg);
	}
	footer .primary {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}
</style>
