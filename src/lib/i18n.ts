import { getContext, setContext } from 'svelte';
import { es, type SharedMessages } from './messages';

const KEY = Symbol('messages');

/** Call while a component initialises: everything below it reads these strings. */
export function setMessages(messages: SharedMessages): void {
	setContext(KEY, messages);
}

/** The strings for the current page; Spanish unless an ancestor chose another language. */
export function getMessages(): SharedMessages {
	return getContext<SharedMessages | undefined>(KEY) ?? es;
}
