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
    description: 'Pages built from the object packages in src/objects.',
    social: [{ icon: 'github', label: 'GitHub', href: REPOSITORY_URL }],
    editLink: { baseUrl: `${REPOSITORY_URL}/edit/main/` },
    // The app's own stylesheet and tokens; wiki.css maps Starlight onto them.
    customCss: ['../site/site.css', './src/wiki.css'],
    components: {
      MarkdownContent: './src/components/ObjectArticle.astro',
      SiteTitle: './src/components/SiteTitle.astro',
      ThemeSelect: './src/components/ThemeSelect.astro',
    },
    sidebar: [
      { label: 'All objects', link: '/' },
      ...groups.map(group => ({
        label: `${group.label} (${group.objects.length})`, collapsed: true,
        items: group.objects.map(object => ({ label: object.title, link: `/${object.id}/` })),
      })),
    ],
  })],
});
