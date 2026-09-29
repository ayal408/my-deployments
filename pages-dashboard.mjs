#!/usr/bin/env node
// Lists all your GitHub repos, checks which have GitHub Pages enabled,
// and writes a clean dashboard (deployments.md + deployments.html).
//
// Usage:
//   GITHUB_TOKEN=xxx node pages-dashboard.mjs            # your own repos (incl. private)
//   node pages-dashboard.mjs <username>                  # public repos of a user
//   node pages-dashboard.mjs --out ./dist                # output directory (default: .)
//
// Token: falls back to `gh auth token` if GITHUB_TOKEN is not set.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args.splice(outIdx, 2)[1] : ".";
const username = args[0];

let token = process.env.GITHUB_TOKEN;
if (!token) {
  try {
    token = execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {}
}
if (!token && !username) {
  console.error("Set GITHUB_TOKEN (or run `gh auth login`), or pass a username.");
  process.exit(1);
}

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token && { Authorization: `Bearer ${token}` }),
};

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (res.status === 404) return null;
  if (res.status === 401) {
    console.error("401: bad or missing token. Set a valid GITHUB_TOKEN or run `gh auth login`.");
    process.exit(1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json();
}

async function allRepos() {
  const base = username
    ? `/users/${username}/repos?per_page=100`
    : `/user/repos?per_page=100&affiliation=owner`;
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await api(`${base}&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) return repos;
  }
}

const esc = (s = "") => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const repos = (await allRepos()).filter((r) => !r.archived && !r.fork);

// Check Pages with limited concurrency.
const rows = [];
let i = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (i < repos.length) {
      const r = repos[i++];
      let live = null;
      if (r.has_pages) {
        const pages = await api(`/repos/${r.full_name}/pages`).catch(() => null);
        live = pages?.html_url ?? null;
      }
      rows.push({
        name: r.name,
        repo: r.html_url,
        live: live ?? (r.homepage || null),
        source: live ? "Pages" : r.homepage ? "Homepage" : null,
        description: r.description ?? "",
        language: r.language ?? "",
        stars: r.stargazers_count ?? 0,
        updated: r.pushed_at?.slice(0, 10) ?? "",
        private: r.private,
      });
    }
  }),
);

rows.sort((a, b) => Number(!!b.live) - Number(!!a.live) || b.updated.localeCompare(a.updated));
const deployed = rows.filter((r) => r.live);

const md = [
  "# My Deployments",
  "",
  `_${deployed.length} live of ${rows.length} repos · generated ${new Date().toISOString().slice(0, 10)}_`,
  "",
  "| Project | Live | Language | ⭐ | Description | Last push |",
  "|---|---|---|---|---|---|",
  ...rows.map(
    (r) =>
      `| [${r.name}](${r.repo})${r.private ? " 🔒" : ""} | ${r.live ? `[open](${r.live})` : "—"} | ${r.language} | ${r.stars} | ${r.description.replace(/\|/g, "\\|")} | ${r.updated} |`,
  ),
  "",
].join("\n");

const LANG_COLORS = {JavaScript:"#f1e05a",TypeScript:"#3178c6",Python:"#3572A5",HTML:"#e34c26",CSS:"#563d7c",Java:"#b07219",Go:"#00ADD8",Rust:"#dea584","C#":"#178600","C++":"#f34b7d",C:"#555555",PHP:"#4F5D95",Ruby:"#701516",Shell:"#89e051",Vue:"#41b883",Dart:"#00B4AB",Kotlin:"#A97BFF",Swift:"#F05138"};
const langColor = (l) => LANG_COLORS[l] ?? "#8b949e";
const today = new Date().toISOString().slice(0, 10);
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>My Deployments</title>
<style>
:root{color-scheme:light dark;--bg:#f6f8fc;--card:#fff;--fg:#14171f;--muted:#667085;--line:#e4e8ef;--accent:#6366f1;--accent2:#ec4899;--ok:#12b76a;--okbg:#e6f9f0;--shadow:0 1px 2px rgba(16,24,40,.06),0 8px 24px rgba(16,24,40,.06)}
@media(prefers-color-scheme:dark){:root{--bg:#0b0d14;--card:#141824;--fg:#eef0f6;--muted:#98a2b3;--line:#232a3b;--accent:#818cf8;--ok:#32d583;--okbg:#0f2a1f;--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35)}}
*{box-sizing:border-box}
body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--fg)}
header{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;padding:56px 16px 88px;text-align:center}
header h1{margin:0 0 8px;font-size:clamp(28px,5vw,44px);letter-spacing:-.02em}
header p{margin:0;opacity:.9}
main{max-width:1040px;margin:-56px auto 48px;padding:0 16px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.stat{background:var(--card);border-radius:14px;padding:16px;box-shadow:var(--shadow);text-align:center}
.stat b{display:block;font-size:28px;line-height:1.1}.stat span{color:var(--muted);font-size:13px}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.bar input{flex:1;min-width:200px;padding:11px 16px;font:inherit;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--fg);box-shadow:var(--shadow)}
.bar input:focus{outline:2px solid var(--accent);border-color:transparent}
.chip{padding:10px 18px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--fg);font:inherit;cursor:pointer}
.chip[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:10px;transition:transform .15s}
.card:hover{transform:translateY(-3px)}
.top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.card h3{margin:0;font-size:18px;overflow-wrap:anywhere}
.card h3 a{color:inherit;text-decoration:none}.card h3 a:hover{color:var(--accent)}
.badge{font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;white-space:nowrap;background:var(--okbg);color:var(--ok)}
.badge.off{background:var(--line);color:var(--muted)}
.desc{color:var(--muted);font-size:14px;flex:1;margin:0}
.meta{display:flex;gap:14px;align-items:center;font-size:13px;color:var(--muted)}
.lang{display:inline-flex;align-items:center;gap:6px}.lang i{width:10px;height:10px;border-radius:50%;display:inline-block}
.foot{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--muted)}
.btn{background:var(--accent);color:#fff;text-decoration:none;padding:7px 14px;border-radius:10px;font-weight:600;font-size:14px}
.btn:hover{filter:brightness(1.1)}
.foot a:not(.btn){color:var(--accent);text-decoration:none;font-weight:600}
.empty{text-align:center;color:var(--muted);padding:32px}
@media(max-width:520px){.stat b{font-size:22px}}
</style></head><body>
<header><h1>🚀 My Deployments</h1><p>Every project, one click away · updated ${today}</p></header>
<main>
<div class="stats">
<div class="stat"><b>${rows.length}</b><span>Projects</span></div>
<div class="stat"><b>${deployed.length}</b><span>Live</span></div>
<div class="stat"><b>${rows.length - deployed.length}</b><span>Not deployed</span></div>
</div>
<div class="bar">
<input id="q" type="search" placeholder="Search projects…" aria-label="Search projects">
<button class="chip" data-f="all" aria-pressed="true">All</button>
<button class="chip" data-f="live" aria-pressed="false">Live only</button>
</div>
<div class="grid" id="list">
${rows
  .map(
    (r) => `<article class="card" data-live="${r.live ? 1 : 0}" data-s="${esc((r.name + " " + r.description).toLowerCase())}">
<div class="top"><h3><a href="${esc(r.repo)}">${esc(r.name)}</a>${r.private ? " 🔒" : ""}</h3>
<span class="badge${r.live ? "" : " off"}">${r.live ? "● Live" : "Not deployed"}</span></div>
<p class="desc">${esc(r.description) || "No description"}</p>
<div class="meta">${r.language ? `<span class="lang"><i style="background:${langColor(r.language)}"></i>${esc(r.language)}</span>` : ""}<span>⭐ ${r.stars}</span></div>
<div class="foot"><span>Pushed ${r.updated}</span>${r.live ? `<a class="btn" href="${esc(r.live)}">Open ↗</a>` : `<a href="${esc(r.repo)}">Repo</a>`}</div>
</article>`,
  )
  .join("\n")}
</div>
<p class="empty" id="empty" hidden>No projects match.</p>
</main>
<script>
let f="all";
function apply(){const v=q.value.toLowerCase().trim();let n=0;
for(const c of list.children){const ok=c.dataset.s.includes(v)&&(f==="all"||c.dataset.live==="1");c.hidden=!ok;n+=ok}
empty.hidden=n>0}
q.oninput=apply;
for(const b of document.querySelectorAll(".chip"))b.onclick=()=>{f=b.dataset.f;
document.querySelectorAll(".chip").forEach(x=>x.setAttribute("aria-pressed",x===b));apply()};
</script></body></html>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "deployments.md"), md);
writeFileSync(join(outDir, "deployments.html"), html);

console.table(deployed.map((r) => ({ name: r.name, live: r.live })));
console.log(`\nWrote ${join(outDir, "deployments.md")} and ${join(outDir, "deployments.html")}`);
