import express from "express";
import puppeteer from "puppeteer";

const app = express();
app.use(express.json({ limit: "2mb" }));

/* ─────────────────────────────────────────────
   🧠 CACHE GLOBAL DU BROWSER
   → Chromium reste chaud tant que la machine tourne
───────────────────────────────────────────── */
let browser;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

/* ─────────────────────────────────────────────
   🧠 CACHE EMOJIS (RAM)
   → plus aucune requête réseau pendant le rendu
───────────────────────────────────────────── */
const emojiCache = new Map();

/**
 * Télécharge un emoji PNG et le convertit en base64
 */
async function loadEmoji(url) {
  if (emojiCache.has(url)) {
    return emojiCache.get(url);
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch emoji: ${url}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const base64 = `data:image/png;base64,${buffer.toString("base64")}`;

  emojiCache.set(url, base64);
  return base64;
}

/**
 * Remplace une grille d’URLs par une grille base64
 */
async function resolveGrid(grid) {
  return Promise.all(
    grid.map(row =>
      Promise.all(
        row.map(url => loadEmoji(url))
      )
    )
  );
}

/* ─────────────────────────────────────────────
   🎨 ROUTE DE RENDU
───────────────────────────────────────────── */
app.post("/render", async (req, res) => {
  try {
    const { grid } = req.body;

    // ✅ guard solide
    if (!Array.isArray(grid) || !grid.length || !grid[0]?.length) {
      return res.status(400).json({ error: "grid must be a 2D array" });
    }

    // 🔥 conversion URLs → base64 (cache RAM)
    const resolvedGrid = await resolveGrid(grid);

    const rows = resolvedGrid.length;
    const cols = resolvedGrid[0].length;

    /* ─────────────────────────────────────────────
       🧠 AUTO-ADAPTATION DISCORD MOBILE (ANTI CROP)
       → on adapte selon la HAUTEUR, pas le device
    ───────────────────────────────────────────── */
    const MAX_HEIGHT = 720;

    let CELL = 80;
    let GAP = 6;

    const estimatedHeight = rows * CELL + (rows - 1) * GAP;

    if (estimatedHeight > MAX_HEIGHT) {
      CELL = 64;
      GAP = 4;
    }

    /* ─────────────────────────────────────────────
       📄 TEMPLATE HTML (fond TRANSPARENT)
    ───────────────────────────────────────────── */
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <style>
    :root {
      --cell: ${CELL}px;
      --gap: ${GAP}px;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
    }

    body {
      display: inline-block;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(${cols}, var(--cell));
      gap: var(--gap);
    }

    .cell {
      width: var(--cell);
      height: var(--cell);
    }

    .cell img {
      width: 100%;
      height: 100%;
      display: block;
      image-rendering: pixelated;
    }
  </style>
</head>

<body>
  <div class="grid">
    ${resolvedGrid
      .flat()
      .map(
        (src) => `
      <div class="cell">
        <img src="${src}" />
      </div>
    `
      )
      .join("")}
  </div>
</body>
</html>
`;

    /* ─────────────────────────────────────────────
       🚀 PUPPETEER (OPTIMISÉ)
    ───────────────────────────────────────────── */
    const browser = await getBrowser();
    const page = await browser.newPage();

    // ✅ VIEWPORT EXACT (cell + gaps)
    await page.setViewport({
      width: cols * CELL + (cols - 1) * GAP,
      height: rows * CELL + (rows - 1) * GAP,
      deviceScaleFactor: 1.5,
    });

    // ⚠️ PAS de networkidle0
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    // ⏳ sécurité : attendre que les images soient prêtes
    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.race([
        Promise.all(
          imgs.map(
            img =>
              img.complete ||
              new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
              })
          )
        ),
        new Promise(resolve => setTimeout(resolve, 2000)),
      ]);
    });

    const buffer = await page.screenshot({
      type: "png",
      omitBackground: true,
      compressionLevel: 9,
    });

    await page.close();

    res.setHeader("Content-Type", "image/png");
    res.send(buffer);
  } catch (err) {
    console.error("Renderer error:", err);
    res.status(500).json({ error: "Render failed" });
  }
});

/* ─────────────────────────────────────────────
   🧪 ROUTE TEST
───────────────────────────────────────────── */
app.get("/", (_, res) => {
  res.send("Nexordle Renderer OK");
});

/* ─────────────────────────────────────────────
   🌐 PORT (Fly.io)
───────────────────────────────────────────── */
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Renderer listening on port", port);
});

