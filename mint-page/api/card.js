import { tokenId, tokenGif, gifFrame, cardPng, FOREVER } from "./_share.js";

// GET /t/:id.png: a 1200x630 preview card of the token's GIF (its first frame, 8x, hard pixels).
export default async function handler(req, res) {
  const id = tokenId(req.query.id);
  if (!id) { res.status(404).setHeader("Cache-Control", "no-store").send("Not found"); return; }
  try {
    const png = cardPng(gifFrame(await tokenGif(id)));
    res.status(200).setHeader("Content-Type", "image/png").setHeader("Cache-Control", FOREVER).send(png);
  } catch (error) {
    res.status(error.missing ? 404 : 502).setHeader("Cache-Control", "no-store").send(error.missing ? "Not minted yet" : "Could not read the chain");
  }
}
