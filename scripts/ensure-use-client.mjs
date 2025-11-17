import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DIST_DIR = new URL("../dist", import.meta.url);
const TARGET_PATTERNS = ["WSClientProvider", "useWSClient", "WSSidebar"];

async function main() {
  const root = DIST_DIR.pathname;
  const entries = await readdir(root, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
      .map(async (entry) => {
        const filePath = join(root, entry.name);
        const code = await readFile(filePath, "utf8");

        const alreadyClient = code.startsWith("\"use client\";") || code.startsWith("'use client';");
        if (alreadyClient) {
          return;
        }

        const hasClientHooks = TARGET_PATTERNS.some((pattern) => code.includes(pattern));
        if (!hasClientHooks) {
          return;
        }

        const next = `"use client";\n${code}`;
        await writeFile(filePath, next, "utf8");
      })
  );
}

await main();
