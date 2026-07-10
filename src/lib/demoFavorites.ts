const KEY = 'demo_favorites';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function getDemoFavorites(storage: StorageLike = localStorage): Set<string> {
	try {
		const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? '[]');
		return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
	} catch {
		return new Set();
	}
}

export function toggleDemoFavorite(
	publicId: string,
	storage: StorageLike = localStorage
): Set<string> {
	const favorites = getDemoFavorites(storage);
	if (favorites.has(publicId)) favorites.delete(publicId);
	else favorites.add(publicId);
	storage.setItem(KEY, JSON.stringify([...favorites]));
	return favorites;
}
