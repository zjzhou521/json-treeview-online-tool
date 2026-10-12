# JSON Tree Viewer

A private, browser-based JSON tree viewer. Paste JSON or open a local file, then explore, search, copy paths and values, format, minify, or download the parsed data. No data is sent to a server.

## Run locally

Requires Node.js 22 or later.

```bash
npm ci
npm run dev
```

Open the URL Vite prints. `npm run build` checks TypeScript and creates the static site in `dist/`.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys on every push to `main`, and can also be started manually. In the repository's **Settings → Pages**, choose **GitHub Actions** as the build and deployment source. The site URL is:

https://zjzhou521.github.io/json-treeview-online-tool/

The production build uses `/json-treeview-online-tool/` as its asset base path. If you rename the repository, update `vite.config.ts` and the URL above.

If `actions/configure-pages` reports `Get Pages site failed ... Not Found`, the one-time Pages source setting above has not been enabled yet. The workflow's default `GITHUB_TOKEN` cannot use the action's `enablement: true` option to make that change automatically. After selecting **GitHub Actions** in Settings, rerun the workflow or push another commit.
