<script lang="ts">
	export type IconName =
		| 'close'
		| 'chevron-left'
		| 'chevron-right'
		| 'star'
		| 'download'
		| 'expand'
		| 'collapse'
		| 'search'
		| 'upload'
		| 'photos'
		| 'more';

	let { name, filled = false, size = 20 }: { name: IconName; filled?: boolean; size?: number } = $props();

	const PATHS: Record<IconName, string> = {
		close: 'M6 6l12 12M18 6L6 18',
		'chevron-left': 'M15 5l-7 7 7 7',
		'chevron-right': 'M9 5l7 7-7 7',
		star: 'M12 3.5l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.3l-5.4 3 1.1-6.1-4.5-4.3 6.1-.8z',
		download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
		expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
		collapse: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
		search: 'M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-4.5-4.5',
		upload: 'M12 16V5m0 0L8 9m4-4l4 4M5 20h14',
		photos: 'M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z',
		more: 'M5 12h.01M12 12h.01M19 12h.01'
	};
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill={filled ? 'currentColor' : 'none'}
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	<path d={PATHS[name]} />
</svg>
