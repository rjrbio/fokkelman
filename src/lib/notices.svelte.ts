// Browser only: never call from server code (module state is shared across requests).

/** How long a notice stays up before it dismisses itself. */
export const NOTICE_MS = 3000;

/** The last thing the app told the person that is not a problem ("link copied"), or `text: ''`. Read it inside a template. */
export const notice = $state<{ text: string }>({ text: '' });
let timer: ReturnType<typeof setTimeout> | undefined;

export function dismissNotice(): void {
	clearTimeout(timer);
	timer = undefined;
	notice.text = '';
}

export function showNotice(text: string): void {
	dismissNotice();
	notice.text = text;
	timer = setTimeout(dismissNotice, NOTICE_MS);
}
