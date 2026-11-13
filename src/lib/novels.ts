import { getCollection, type CollectionEntry } from 'astro:content';

export type Novel = CollectionEntry<'novels'>;
export type Chapter = CollectionEntry<'chapters'>;

// โชว์ draft เฉพาะตอน dev
const visible = ({ data }: { data: { draft: boolean } }) => import.meta.env.DEV || !data.draft;

export async function getNovels(): Promise<Novel[]> {
	const novels = (await getCollection('novels', visible)) as Novel[];
	return novels.sort((a, b) => (b.data.updatedAt?.getTime() ?? 0) - (a.data.updatedAt?.getTime() ?? 0));
}

/** ชื่อไฟล์ตอน เช่น "001" → { slug: "001", number: 1 } */
export function chapterSlug(c: Chapter) {
	return c.id.split('/')[1];
}
export function chapterNumber(c: Chapter) {
	return parseInt(chapterSlug(c), 10);
}

export async function getChapters(novelId: string): Promise<Chapter[]> {
	const all = (await getCollection('chapters', visible)) as Chapter[];
	return all
		.filter((c) => c.id.startsWith(`${novelId}/`))
		.sort((a, b) => chapterNumber(a) - chapterNumber(b));
}

export const novelUrl = (novelId: string) => `/novels/${novelId}/`;
export const chapterUrl = (novelId: string, slug: string) => `/novels/${novelId}/${slug}/`;

export const formatDate = (d: Date) =>
	d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
