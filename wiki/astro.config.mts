import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { REPOSITORY_URL, readObjects, systemGroups, type SystemEntry } from './src/objects.mts';

// The sidebar nests the same packages the content loader turns into pages: system, classification, body, its satellites.
const systems = systemGroups(readObjects());
const count = (entries: readonly SystemEntry[]): number => entries.reduce((total, entry) => total + 1 + count(entry.satellites), 0);
type SidebarItem = { label: string; link: string } | { label: string; collapsed: boolean; items: SidebarItem[] };
const item = (entry: SystemEntry): SidebarItem =>
  entry.satellites.length
    // A body with satellites opens like a Storybook component: its own page first, then what orbits it.
    ? { label: entry.object.title, collapsed: true, items: [{ label: 'Overview', link: `/${entry.object.id}/` }, ...entry.satellites.map(item)] }
    : { label: entry.object.title, link: `/${entry.object.id}/` };

export default defineConfig({
  server: { host: '127.0.0.1', port: 4281 },
  vite: { server: { fs: { allow: ['..'] } } },
  integrations: [starlight({
    title: 'cssEarth wiki',
    description: 'Pages built from the object packages in src/objects.',
    social: [{ icon: 'github', label: 'GitHub', href: REPOSITORY_URL }],
    editLink: { baseUrl: `${REPOSITORY_URL}/edit/main/` },
    // Storybook's layout on Starlight: brand and search above the tree, a toolbar above the page, canvas and args blocks per object.
    customCss: ['../site/site.css', './src/wiki.css'],
    components: {
      Header: './src/components/Header.astro',
      PageTitle: './src/components/PageTitle.astro',
      MarkdownContent: './src/components/ObjectArticle.astro',
      SiteTitle: './src/components/SiteTitle.astro',
      ThemeProvider: './src/components/ThemeProvider.astro',
      ThemeSelect: './src/components/ThemeSelect.astro',
    },
    sidebar: [
      { label: 'All objects', link: '/' },
      ...systems.map(system => ({
        label: `${system.label} (${system.groups.reduce((total, group) => total + count(group.entries), 0)})`, collapsed: true,
        items: [
          ...(system.star ? [{ label: system.star.title, link: `/${system.star.id}/` }] : []),
          ...system.groups.map(group => ({ label: `${group.label} (${count(group.entries)})`, collapsed: true, items: group.entries.map(item) })),
        ],
      })),
    ],
  })],
});
