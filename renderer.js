import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function renderGrid(grid) {
  const htmlTemplate = await fs.readFile(
    path.join(__dirname, "template.html"),
    "utf8"
  );

  const cells = grid
    .map(
      row =>
        `<div class="row">${row
          .map(url => `<img src="${url}" />`)
          .join("")}</div>`
    )
    .join("");

  const html = htmlTemplate.replace("{{GRID}}", cells);

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const buffer = await page.screenshot({
    type: "png",
    omitBackground: true,
  });

  await browser.close();
  return buffer;
}
