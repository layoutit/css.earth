import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { REPOSITORY_URL, groupObjects, readObjects } from './src/objects.mts';

// The sidebar lists the same packages the content loader turns into pages.
const groups = groupObjects(readObjects());

export default defineConfig({
  server: { host: '127.0.0.1', port: 4281 },
  vite: { server: { fs: { allow: ['..'] } } },
  integrations: [starlight({
    title: 'cssEarth wiki',
    description: 'Every object in cssEarth: what it is, where its data comes from and what is still unresolved.',
    social: [{ icon: 'github', label: 'GitHub', href: REPOSITORY_URL }],
    editLink: { baseUrl: `${REPOSITORY_URL}/edit/main/` },
    customCss: ['./src/wiki.css'],
    components: { MarkdownContent: './src/components/ObjectArticle.astro' },
    sidebar: [
      { label: 'All objects', link: '/' },
      ...groups.map(group => ({
        label: `${group.label} (${group.objects.length})`, collapsed: true,
        items: group.objects.map(object => ({ label: object.title, link: `/${object.id}/` })),
      })),
    ],
  })],
});
