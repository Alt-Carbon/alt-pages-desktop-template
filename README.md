# alt-pages-desktop-template

A personal website as a computer desktop. Your pages are icons; each opens in a window you can drag, resize and minimise. About opens in Notepad when someone arrives. Writing is a journal, Reading is your Goodreads bookshelf, and there are easter eggs. Built with Astro, edited with Sveltia CMS at `/admin`, hosted as a Cloudflare Worker. MIT licensed.

It reads the same content files as the Sidebar template (`alt-pages-minimal-template`), so a person can switch between the two without retyping anything.

## Run it locally

```
npm install
npm run dev        # http://localhost:4321
npm run build      # writes dist/
npm run preview    # serves dist/ through the Worker, the way Cloudflare will, at http://localhost:8787
npm test           # reading-sync parser tests, no network
```

`npm run dev` and `npm run build` first run `scripts/prepare.mjs`, which reads the repository name from git, writes the editor's configuration to `public/admin/config.yml`, and writes the Goodreads profile id to `public/reading/config.json`. None of these are committed.

`npm run preview` rebuilds when something under `src/` changes, but not when `content/` changes; rebuild by hand after editing content.

## Deploy

`wrangler.jsonc` describes the Worker: the built pages as static assets, the reading sync, a KV namespace, a Durable Object and a 12-hour cron. The Worker is called `my-desktop`, so it never collides with a Sidebar site in the same Cloudflare account. `npm run deploy` builds and deploys to whichever account wrangler is logged into.

## Content

Everything on the site is a file under `content/`, the same files as the Sidebar template. The editor at `/admin` edits them for you.

| File | Where it shows |
| --- | --- |
| `content/site.json` | Name, links, photo, accent colour, Goodreads profile, bookshelf style, and the Desktop settings below |
| `content/about.json` | `about.txt` in Notepad, and System Properties |
| `content/now.json` | `now.txt` in Notepad (when switched on); its "Not doing" items fill the Recycle Bin |
| `content/writing/*.md` | Writing: one Markdown file per piece |
| `content/writing.json` | The Writing page's description for search results |
| `content/research.json` | Research, by year |
| `content/reading.json` | Reading: the subtitle and the Links tab. Books come from Goodreads |

The shapes are defined once in `src/lib/schemas.ts`; the build checks every file and fails with a readable message if something is off. A window whose page is switched off or empty has no icon.

### Desktop settings

Under Site settings → Desktop in the editor (`desktop` in `content/site.json`):

| Setting | What it does |
| --- | --- |
| Wallpaper | Contours, Paddy, Monsoon, Dusk, Crushed basalt, Sage grain or Plain. Each is drawn in the browser from a fixed seed and brings its own accent colour. Plain uses the site's accent colour |
| Your own wallpaper | A photo used instead; the accent colour is taken from it |
| Your city | For your local time and weather on the taskbar. Empty uses About's "Based in" fact, then Place |
| Show the weather | Off removes the weather and time from the taskbar |
| Visitors can write notes | Visitors' own notes in Writing, and margin notes on your pieces |
| Start-up screen | The two-second boot screen on the first page of a visit |
| Pinned to the desktop | Pieces of writing that get their own icon |

Visitors can change the wallpaper (or use a picture of their own), the theme and the bookshelf style for themselves.

## What stays in a visitor's browser

Nothing a visitor does is sent anywhere. The desktop keeps it in their own browser's localStorage, under keys that start with `desk:`: wallpaper, theme, icon positions, their own notes (`desk:notes`), margin notes (`desk:margins`), their uploaded wallpaper, and the date of their last visit, which drives the "since your last visit" notification. You, the owner, never see any of it, and neither does anyone else.

Your writing is locked: visitors can read it, select it and keep private notes beside it, but not change it.

The only outside requests are two to [Open-Meteo](https://open-meteo.com), a free weather service that needs no account: one to look up your city (cached in the browser) and one for the current weather (at most every 20 minutes).

## Every window is a page

Each window has an address of its own: `/about`, `/now`, `/writing`, `/writing/<slug>`, `/research`, `/reading`. The page at that address carries the window's content as ordinary HTML, so it reads as a normal page without JavaScript and to search engines; the script then turns it into the desktop with that window open. As visitors move between windows, the address bar follows the window in front, so a copied link opens the same window. A page carries the full text of one piece only; the journal fetches other pieces from their own pages when they are opened.

Titles, descriptions, canonical links, Open Graph and Twitter tags, structured data, a preview card per page under `/og/`, `/rss.xml`, `/sitemap.xml` and `/robots.txt` are made from the content, exactly as in the Sidebar template. The site's address isn't known at build time, so pages carry `https://__origin__` and the Worker swaps in the address the visitor used.

## Reading sync

Unchanged from the Sidebar template. `src/worker/` reads the public Goodreads shelves named in `content/site.json` on a schedule, keeps them in KV, and serves them at `/reading/view.json`, with covers under `/reading/covers/`. Until a profile is connected, the sample shelf in `public/reading/view.json` is served and the editor says so. The Reading window draws the shelf with the Sidebar template's four styles (`src/scripts/shelf/`); Stacks is the default here.

## Layout

| Path | What |
| --- | --- |
| `src/pages/` | One file per address, each the desktop with one window open; plus the generated feeds, sitemap, icons and preview cards |
| `src/layouts/Desktop.astro` | The head, the desktop, the taskbar and menus, and every window's content |
| `src/components/` | The Writing journal, Research and Reading windows |
| `src/lib/desktop.ts` | What the desktop draws from the content: Notepad text, icons, System Properties, the Recycle Bin |
| `src/lib/content.ts`, `schemas.ts`, `cards.ts` | Shared with the Sidebar template: loading and checking content, preview cards |
| `src/scripts/desktop/main.js` | The desktop: windows (WinBox.js), wallpapers, journal and margin notes, shelf, notifications, time and weather, Run, easter eggs |
| `src/scripts/shelf/`, `src/styles/shelf/` | The bookshelf styles, shared with the Sidebar template |
| `src/styles/desktop.css` | The whole stylesheet, including the page without JavaScript |
| `src/worker/` | The reading sync and the address stamping, shared with the Sidebar template |
| `public/admin/` | The editor's entry page; bundle and config are generated |
| `test/` | Reading-sync parser tests |

## Easter eggs

Start → Run takes commands (`help` lists them). Notepad can't save. The Recycle Bin holds what you set down on purpose. System Properties counts your words. Leave the desktop alone for two minutes. Shut it down. Try the Konami code.
