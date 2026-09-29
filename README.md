# 🚀 my-deployments

A personal dashboard of all my GitHub projects and their live GitHub Pages deployments. It rebuilds itself every day.

**Live dashboard:** https://ayal408.github.io/my-deployments/

## What it shows

For every repo (forks and archived repos are skipped):

- Project name and link to the repo
- Live status, with a link to the deployed site (GitHub Pages, or the repo's Homepage if set)
- Primary language and star count
- Description and last push date
- Search box and a "Live only" filter

## How it works

`pages-dashboard.mjs` (Node 18+, no dependencies) calls the GitHub API, checks which repos have Pages enabled, and writes:

- `deployments.html` (published as `index.html`)
- `deployments.md`, a plain Markdown table

The workflow `.github/workflows/deployments-dashboard.yml` runs the script and deploys the result to GitHub Pages:

- daily at 06:00 UTC
- on every push to `main` that changes the script or workflow
- manually, from **Actions → Deployments dashboard → Run workflow**

## Setup

1. **Settings → Pages → Source = GitHub Actions**
2. Run the workflow once from the Actions tab.
3. *(Optional)* Include private repos: add a repository secret named `DASHBOARD_TOKEN` (a Personal Access Token with `repo` scope).

> Without `DASHBOARD_TOKEN` only your public repos are listed. With it, private repos (marked 🔒) appear on a public page, so only add it if that is what you want.

## Run locally

```bash
GITHUB_TOKEN=xxx node pages-dashboard.mjs --out site   # your repos, incl. private
node pages-dashboard.mjs <username> --out site         # a user's public repos
```

If `GITHUB_TOKEN` isn't set, the script tries `gh auth token`.
