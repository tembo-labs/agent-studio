# Tembo Agent Studio — user manual

The product user manual, built with [Astro Starlight](https://starlight.astro.build/)
and published to GitHub Pages at **https://tembo.github.io/agent-studio/**.

This is a self-contained Astro project (its own `package.json` / lockfile) — it
does not share the `web/` workspace.

## Run locally

```bash
cd docs
pnpm install
pnpm dev      # http://localhost:4321/agent-studio/
```

`pnpm build` writes the static site to `docs/dist/`; `pnpm preview` serves that
build.

## Authoring

Pages are Markdown / MDX under `src/content/docs/`. Each file needs a frontmatter
`title:` (and ideally a `description:`). The left sidebar order is defined
explicitly in `astro.config.mjs` — add a new page there after creating the file.
Full-text search (Pagefind) and the "Edit page" links are automatic.

## Publishing

A push to `main` that touches `docs/**` triggers
`.github/workflows/deploy-docs.yml`, which builds the site and deploys it to
GitHub Pages. You can also run that workflow manually (`workflow_dispatch`).

**One-time setup:** in the repo's **Settings → Pages → Build and deployment**,
set **Source = "GitHub Actions"**. Until that's done the deploy job has no Pages
site to publish to.

## Moving to a custom domain later

In `astro.config.mjs` set `site` to the domain and `base` to `"/"`, add a
`public/CNAME` file containing the domain, and point a DNS `CNAME` at
`tembo.github.io`. No content changes needed.
