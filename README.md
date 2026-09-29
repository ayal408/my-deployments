# my-deployments

Auto-generated dashboard of my GitHub Pages deployments, rebuilt daily by
`.github/workflows/deployments-dashboard.yml` and published at
https://ayal408.github.io/my-deployments/

Setup: Settings → Pages → Source = **GitHub Actions**. Optional secret
`DASHBOARD_TOKEN` (PAT with `repo` scope) to include private repos.

Local run: `GITHUB_TOKEN=xxx node pages-dashboard.mjs --out site`
