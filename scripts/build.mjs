import { spawnSync } from "node:child_process";

// Sites uses Vinext's Cloudflare-worker bundle. Vercel needs standard Next.js
// output (.next), so this repository can deploy cleanly to either platform.
const command = process.env.VERCEL ? "next" : "vinext";
const result = spawnSync(command, ["build"], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
