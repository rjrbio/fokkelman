const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** What can take the focus inside `node` right now (hidden things cannot). */
export function focusableWithin(node: HTMLElement): HTMLElement[] {
	return [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
		(element) => element.getClientRects().length > 0
	);
}

/** True when a key press is meant for a form field, not for a keyboard shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
	);
}

/** The modals that are open, the last one on top: only that one traps the focus. */
const traps: HTMLElement[] = [];

/**
 * Listens on the document, not on the modal: when the focus has dropped on <body> (the button that had
 * it was disabled by its own press, say) a Tab never goes through the modal, and this is how it is
 * brought back in.
 */
function onDocumentKeydown(event: KeyboardEvent) {
	const node = traps[traps.length - 1];
	if (event.key !== 'Tab' || !node) return;
	const items = focusableWithin(node);
	if (items.length === 0) {
		event.preventDefault();
		node.focus({ preventScroll: true });
		return;
	}
	const first = items[0];
	const last = items[items.length - 1];
	const active = document.activeElement;
	if (!node.contains(active) || (event.shiftKey && (active === first || active === node))) {
		event.preventDefault();
		(event.shiftKey ? last : first).focus();
	} else if (!event.shiftKey && active === last) {
		event.preventDefault();
		first.focus();
	}
}

/**
 * For a modal: moves the focus into `node` (give it `tabindex="-1"`), keeps Tab and Shift+Tab
 * inside it wherever the focus is, and hands the focus back to whatever had it before when `node`
 * goes away. With several modals open at once, only the last one opened traps the focus.
 */
export function focusTrap(node: HTMLElement) {
	const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	node.focus({ preventScroll: true });

	if (traps.length === 0) document.addEventListener('keydown', onDocumentKeydown);
	traps.push(node);
	return {
		destroy() {
			const index = traps.indexOf(node);
			if (index !== -1) traps.splice(index, 1);
			if (traps.length === 0) document.removeEventListener('keydown', onDocumentKeydown);
			// Do not scroll: the page behind is exactly where the user left it.
			if (opener?.isConnected) opener.focus({ preventScroll: true });
		}
	};
}

/**
 * Calls `onLoaded` when `image` has loaded, including when it already had by the time this runs;
 * returns the function that stops listening. Use it from an `$effect` rather than with an `onload`
 * attribute or a `use:` action on the `<img>`: on a server-rendered page Svelte then writes an
 * inline `onload` handler (to replay a load that happens before hydration), which the CSP blocks.
 */
export function watchLoad(image: HTMLImageElement, onLoaded: () => void): () => void {
	if (image.complete && image.naturalWidth > 0) onLoaded();
	image.addEventListener('load', onLoaded);
	return () => image.removeEventListener('load', onLoaded);
}

/**
 * After a tap that makes the thing under the finger disappear or change, the browser still fires the
 * tap's click, at whatever is under the finger by then (a button of the panel that has just come
 * back, say). Call this from the tap's handler to throw that one click away. It gives up after `ms`
 * if no click comes (a tap that did not become one).
 */
export function swallowNextClick(ms = 400): void {
	const timer = setTimeout(stop, ms);

	function stop() {
		clearTimeout(timer);
		window.removeEventListener('click', swallow, true);
	}

	function swallow(event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();
		stop();
	}

	window.addEventListener('click', swallow, true);
}
