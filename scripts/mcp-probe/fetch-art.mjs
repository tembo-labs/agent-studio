import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

mkdirSync("art", { recursive: true });
const rows = readFileSync("domains.txt", "utf8").trim().split("\n").map((l) => l.split(" "));

const s2def = createHash("md5")
  .update(new Uint8Array(await (await fetch("https://www.google.com/s2/favicons?domain=zzznotarealdomainxyz123.com&sz=128")).arrayBuffer()))
  .digest("hex");

const isPng = (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50;
const isIco = (b) => b.length > 4 && b[0] === 0 && b[1] === 0 && b[2] === 1;
const isSvg = (b) => b.slice(0, 300).toString("latin1").toLowerCase().includes("<svg");
const isJpg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;

async function get(url) {
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch { return null; }
}

const results = [];
const queue = [...rows];
async function worker() {
  for (;;) {
    const row = queue.shift();
    if (!row) return;
    const [slug, domain] = row;
    let src = null, buf = null, ext = "png";
    for (const p of ["apple-touch-icon.png", "apple-touch-icon-precomposed.png"]) {
      const b = await get(`https://${domain}/${p}`);
      if (b && isPng(b) && b.length >= 1000) { src = "apple-touch-icon"; buf = b; break; }
    }
    if (!buf) {
      const b = await get(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
      if (b && b.length >= 500) {
        const h = createHash("md5").update(new Uint8Array(b)).digest("hex");
        if (h !== s2def && (isPng(b) || isIco(b) || isJpg(b))) {
          src = "s2"; buf = b;
          ext = isPng(b) ? "png" : isJpg(b) ? "jpg" : "ico";
        }
      }
    }
    if (buf) {
      writeFileSync(`art/${slug}.${ext}`, buf);
      results.push([slug, src, buf.length, ext]);
    } else results.push([slug, "FAIL", 0, ""]);
  }
}
await Promise.all(Array.from({ length: 10 }, worker));
results.sort((a, b) => a[0].localeCompare(b[0]));
for (const r of results) console.log(r.join("\t"));
const c = (k) => results.filter((r) => r[1] === k).length;
console.log(`-- apple-touch-icon: ${c("apple-touch-icon")}, s2: ${c("s2")}, FAIL: ${c("FAIL")}`);
writeFileSync("art-results.json", JSON.stringify(results));
