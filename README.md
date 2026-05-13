# Get Shit Done

A dead-simple, mobile-first PWA that helps you actually finish tasks. Dump tasks by typing or voice, the app sorts them, schedules check-ins, and keeps pushing you toward the next best action.

Built with **React 18 + Vite 5 + TypeScript + Tailwind CSS + shadcn/ui**. Data is stored locally in `localStorage` — no backend required.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:8080.

## Build

```bash
npm run build
npm run preview
```

## Install as an iPhone PWA

1. Open the deployed URL in Safari on iPhone.
2. Tap the Share icon → **Add to Home Screen**.
3. Launch from the home screen for the full app feel (standalone, dark status bar).

## Deploy to Vercel

### Option A — Vercel Dashboard (recommended)

1. Push this repo to GitHub (see below).
2. Go to https://vercel.com/new and **Import** the repository.
3. Vercel auto-detects Vite. Defaults are fine:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Click **Deploy**. Done.

The included `vercel.json` adds an SPA rewrite so React Router deep links work on refresh.

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel            # first deploy (preview)
vercel --prod     # production deploy
```

## Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Get Shit Done"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

## Project structure

```
public/              PWA manifest, icons, robots.txt
src/
  components/        AppShell, BottomNav, NextBest, TaskRow, ReminderRunner, ui/*
  pages/             Today, Capture, TaskDetail, Categories, Settings, NotFound
  store/tasks.tsx    Task context + nextBest selection
  lib/               parser, storage, demo data, types, utils
  index.css          Design tokens (HSL) + utility classes
  App.tsx            Routes
index.html           PWA meta tags
vite.config.ts       Vite + path alias @ -> ./src
tailwind.config.ts   Design tokens
vercel.json          SPA rewrite for Vercel
```

## License

MIT — do whatever you want.
