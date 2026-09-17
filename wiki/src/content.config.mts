import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsSchema } from '@astrojs/starlight/schema';
import { objectPagesLoader } from './object-pages.mts';

export const collections = {
  docs: defineCollection({
    loader: objectPagesLoader(),
    schema: docsSchema({
      extend: ({ image }) => z.object({
        object: z.object({
          id: z.string(), group: z.string(), groupLabel: z.string(), system: z.string().nullable(), status: z.string().nullable(),
          facts: z.array(z.object({ label: z.string(), value: z.string() })),
          image: image().optional(), maps: z.number(), openQuestions: z.number(),
          sourceFiles: z.number(), sourceSize: z.string(), runtimeSize: z.string(), appUrl: z.url().optional(),
        }).optional(),
      }),
    }),
  }),
};
