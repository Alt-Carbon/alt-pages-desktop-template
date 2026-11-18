# AGENTS.md

This repository is one person's website, made from the Alt Pages **Desktop** template: the site as a computer desktop: icons, windows you can drag, a Notepad that opens on About, a taskbar. It is an Astro site served by a Cloudflare Worker, and Cloudflare builds and publishes it about two minutes after anything is pushed to `main`.

The owner is probably not a developer. Explain what you are about to change in plain words, change one thing at a time, show them the result, and ask before anything on the "ask first" list below.

## The rule that matters most: updates replace the code

Once a week (and whenever the owner presses Site updates → Update now in the editor), the site's Worker copies the latest version of the template into this repository as one commit. That replaces every file **except**:

- `content/`: the words, settings and the owner's own styles
- `public/media/`: photos and files
- `.github/`

(`wrangler.jsonc`, `package.json` and `package-lock.json` are merged, so the site keeps its own name and storage.)

So a change anywhere else, such as `src/`, `public/` or `scripts/`, is undone at the next update.

## Where each kind of change goes

| The owner wants | Change | Survives updates |
|---|---|---|
| Colours, fonts, sizes, spacing, hiding something | `content/custom.css` | Yes |
| Words, links, photos, which pages show | `content/*.json`, `content/writing/*.md`, or the editor at `/admin` | Yes |
| A setting the template already has (accent colour, …) | `content/site.json`, or the editor | Yes |
| A different layout or new behaviour | `src/` | **No**, see below |

If what they ask for needs `src/`, tell them, before you change anything, that the weekly update will undo it. Their choice is to keep updates (and lose the change), or turn updates off and keep the change: `"advanced": { "autoUpdate": false }` in `content/site.json`, or Site settings → Advanced → "Get improvements automatically" in the editor. Updates off means no more fixes from the template. Never turn them off without asking.

## content/custom.css

Every page loads it after the template's own styles (it is the first thing in `<body>`), so a rule here wins over the template's rule with the same selector. Prefer changing the variables below over rewriting the template's rules: it is shorter, and it keeps working when the template changes. Keep the file small and add a short comment above each change, so the owner can read it. Emptying the file brings back the template's look.

Example:

```css
/* A plain purple desktop and purple highlights, whatever wallpaper a visitor picked */
#wall { display: none; }
:root { --desk-b: #3b2a6b !important; --accent: #6a3fd1 !important; }
```

## Desktop: what you can change

Files: `src/layouts/Desktop.astro` (the desktop), `src/styles/desktop.css` (desktop, windows, taskbar), `src/components/`, `src/pages/` (what opens in each window).

### Colours

| Variable | What it colours |
|---|---|
| `--desk-b` | the desktop under the wallpaper (see below) |
| `--paper` | inside windows |
| `--chrome` | window frames and the taskbar |
| `--ink`, `--mute` | text, and secondary text |
| `--rule` | lines and borders |
| `--accent`, `--accent-ink` | highlights and focus rings, and text on them |
| `--shadow` | windows' hard shadow (`6px 6px 0 var(--ink)`) |

Corners are square on purpose (`--radius-*: 0`).

The wallpaper is a picture the page draws itself (the `#wall` canvas). Each visitor picks one with "Change wallpaper…", and each wallpaper sets `--desk-b` and `--accent` on the page directly, which beats this file. So these two need `!important` here, and to replace the wallpaper with a plain colour, hide `#wall`.

### Type

`--font-display` (headings; a serif), `--font-text` (what you read, Notepad too), `--font-ui` (icons, menus, buttons). Sizes are `--fs-*` steps. `--task-h` is the taskbar's height, `--head-h` a window's title bar.

### Parts of the page

`.icon` desktop icons · `.winbox` and `.wb-*` windows and their title bars (the WinBox library, restyled here) · `.task` the taskbar · `.explorer` folder windows · `.dlgbody` dialogs · `.essay` a piece of writing · `.toast` small notices

## Ask first, or leave alone

- `wrangler.jsonc`: the Worker's name, storage ids and routes. Changing them breaks the site or loses the owner's data.
- `src/worker/`: sign-in for the editor, the reading and posts sync, the weekly update.
- `public/admin/` (the editor) and `scripts/prepare.mjs` (writes the editor's settings at build time).
- Never commit passwords, tokens or keys.

## Check your work

```sh
npm ci
npm run build   # runs scripts/prepare.mjs first; must succeed, or Cloudflare won't publish
npm test
npm run dev     # look at it; it prints the address
```

The shape of every content file is in `src/content.config.ts`. A build that fails on Cloudflare leaves the live site as it was, but tell the owner.

## Publishing

Pushing to `main` publishes. For anything bigger than a small style change, work on a branch, show the owner screenshots from `npm run dev`, and merge when they are happy. If Cloudflare is set to build other branches, it also gives each branch its own preview address.
