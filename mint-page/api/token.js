import { tokenId, tokenMetadata, tokenPage, originOf, FOREVER } from "./_share.js";

// GET /t/:id: the token's own page, with its preview card for link crawlers.
export default async function handler(req, res) {
  const id = tokenId(req.query.id);
  if (!id) { res.status(404).setHeader("Cache-Control", "no-store").send("Not found"); return; }
  try {
    const html = tokenPage(id, await tokenMetadata(id), originOf(req));
    res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").setHeader("Cache-Control", FOREVER).send(html);
  } catch (error) {
    // Unminted tokens stay uncached, so the page appears as soon as the token exists.
    res.status(error.missing ? 404 : 502).setHeader("Cache-Control", "no-store").send(error.missing ? "Not minted yet" : "Could not read the chain");
  }
}
