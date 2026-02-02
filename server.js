import express from "express";
import puppeteer from "puppeteer";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.post("/render", async (req, res) => {
  const { grid } = req.body;

  if (!Array.isArray(grid)) {
    return res.status(400).json({ error: "grid must be an array" });
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body {
    margin: 0;
    background: #121212;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(${grid[0].length}, 64px);
    grid-gap: 6px;
    padding: 20px;
  }
  .cell img {
    width: 64px;
    height: 64px;
    image-rendering: crisp-edges;
  }
</style>
</head>
<body>
  <div class="grid">
    ${grid.flat().map(url => `
      <div class="cell">
        <img src="${url}" />
      </div>
    `).join("")}
  </div>
</body>
</html>
`;

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const buffer = await page.screenshot({ type: "png" });
  await browser.close();

  res.setHeader("Content-Type", "image/png");
  res.send(buffer);
});

app.get("/", (_, res) => {
  res.send("Nexordle Renderer OK");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Renderer listening on port", port);
});
