import express from "express";
import { renderGrid } from "./renderer.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/render", async (req, res) => {
  try {
    const { grid } = req.body;
    if (!grid) return res.status(400).send("Missing grid");

    const buffer = await renderGrid(grid);

    res.set("Content-Type", "image/png");
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send("Render failed");
  }
});

app.get("/", (_, res) => {
  res.send("Nexordle renderer OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("Renderer running on port", PORT)
);
