import { tokenId, tokenGif, FOREVER } from "./_share.js";

// GET /t/:id.gif: the token's raw GIF, exactly as the contract's gif(id) returns it.
export default async function handler(req, res) {
  const id = tokenId(req.query.id);
  if (!id) { res.status(404).setHeader("Cache-Control", "no-store").send("Not found"); return; }
  try {
    const gif = await tokenGif(id);
    res.status(200).setHeader("Content-Type", "image/gif").setHeader("Content-Disposition", `inline; filename="ghoulballs-${id}.gif"`)
      .setHeader("Cache-Control", FOREVER).send(gif);
  } catch (error) {
    res.status(error.missing ? 404 : 502).setHeader("Cache-Control", "no-store").send(error.missing ? "Not minted yet" : "Could not read the chain");
  }
}
