import express from "express";
import puppeteer from "puppeteer";

const app = express();
app.use(express.json({ limit: "2mb" }));

/* ─────────────────────────────────────────────
   🧠 CACHE DU BROWSER (GAIN x5 à x10)
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
   🎨 ROUTE DE RENDU
───────────────────────────────────────────── */
app.post("/render", async (req, res) => {
  try {
    const { grid } = req.body;

    // ✅ guard solide
    if (!Array.isArray(grid) || !grid.length || !grid[0]?.length) {
      return res.status(400).json({ error: "grid must be a 2D array" });
    }

    const rows = grid.length;
    const cols = grid[0].length;

    const CELL = 80;
    const GAP = 6;

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
    ${grid
      .flat()
      .map(
        (url) => `
      <div class="cell">
        <img src="${url}" />
      </div>
    `
      )
      .join("")}
  </div>
</body>
</html>
`;

    /* ─────────────────────────────────────────────
       🚀 PUPPETEER (RAPIDE)
    ───────────────────────────────────────────── */
    const browser = await getBrowser();
    const page = await browser.newPage();

    // ✅ VIEWPORT EXACT (cell + gaps)
    await page.setViewport({
      width: cols * CELL + (cols - 1) * GAP,
      height: rows * CELL + (rows - 1) * GAP,
      deviceScaleFactor: 2,
    });

await page.setContent(html, { waitUntil: "domcontentloaded" });

    const buffer = await page.screenshot({
      type: "png",
      omitBackground: true, // ⛔ enlève le noir
    });

    await page.close(); // IMPORTANT (sinon fuite mémoire)

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

