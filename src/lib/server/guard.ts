export function isPrivatePath(pathname: string): boolean {
	return pathname === '/app' || pathname.startsWith('/app/') || pathname.startsWith('/api/');
}
