import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// นิยายแต่ละเรื่อง: src/content/novels/<novel-slug>/index.md
const novels = defineCollection({
	loader: glob({
		pattern: '*/index.md',
		base: './src/content/novels',
		generateId: ({ entry }) => entry.split('/')[0],
	}),
	schema: z.object({
		title: z.string(),
		author: z.string(),
		description: z.string(),
		status: z.enum(['ongoing', 'completed', 'hiatus']).default('ongoing'),
		tags: z.array(z.string()).default([]),
		updatedAt: z.coerce.date().optional(),
		draft: z.boolean().default(false),
	}),
});

// ตอน: src/content/chapters/<novel-slug>/<เลขตอน>.md  เช่น 001.md
const chapters = defineCollection({
	loader: glob({
		pattern: '*/*.md',
		base: './src/content/chapters',
		generateId: ({ entry }) => entry.replace(/\.md$/, ''),
	}),
	schema: z.object({
		title: z.string(),
		publishedAt: z.coerce.date().optional(),
		draft: z.boolean().default(false),
	}),
});

export const collections = { novels, chapters };
