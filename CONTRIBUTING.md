# Contributing to Common Ground

Thanks for helping improve Common Ground. Contributions should preserve its central promise: useful relationship analysis without sending a LinkedIn export to a server.

## Prerequisites

- [Bun](https://bun.sh/) 1.3.14
- Google Chrome, only when regenerating showcase images

## Local setup

```bash
bun install
bun run dev
```

Use the fictional demo workspace for normal development. Do not add real LinkedIn exports, personal contact details, or message history to the repository.

## Project scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the Vite development server |
| `bun run test` | Run the test suite once |
| `bun run build` | Type-check and create a production build |
| `bun run preview` | Preview the production build locally |
| `bun run capture:showcase` | Recreate public screenshots from the fictional demo |

## Before submitting a change

Run the same essential checks used by continuous deployment:

```bash
bun run test
bun run build
```

Add or update tests when behavior changes. Keep dependencies pinned to exact versions and commit `bun.lock` when dependency resolution changes.

## Product and privacy conventions

- Keep archive parsing and personal data in the browser.
- Treat Privacy mode as presentation-layer masking, not file sanitization.
- Preserve honest distinctions between known data and inferred or missing data.
- Keep public demo data entirely fictional.
- Never generate screenshots from a personal archive.
- Avoid describing “no messages found” as proof that no conversation happened elsewhere.

## Regenerating showcase images

With Google Chrome installed, run:

```bash
bun run capture:showcase
```

The script starts Common Ground on port 4173, drives the deterministic fictional demo with Playwright, and replaces the images in `public/showcase`. Review every generated image before committing it, especially for accidental personal information.

## Deployment

The workflow in `.github/workflows/deploy-pages.yml` runs for pushes to `master`. It installs dependencies from the frozen lockfile, runs the tests, builds the application with Bun 1.3.14, and deploys `dist` to GitHub Pages.

Pull requests should pass both tests and the production build. A change should not require secrets or a server to use the core application.
