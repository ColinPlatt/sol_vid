import { tokenId, tokenMetadata, soldOut, tokenPage, originOf, FOREVER, UNTIL_MINTED_OUT } from "./_share.js";

// GET /t/:id: the token's own page, with its preview card for link crawlers.
export default async function handler(req, res) {
  const id = tokenId(req.query.id);
  if (!id) { res.status(404).setHeader("Cache-Control", "no-store").send("Not found"); return; }
  try {
    const [metadata, mintedOut] = await Promise.all([tokenMetadata(id), soldOut().catch(() => false)]);
    const html = tokenPage(id, metadata, originOf(req), mintedOut);
    res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").setHeader("Cache-Control", mintedOut ? FOREVER : UNTIL_MINTED_OUT).send(html);
  } catch (error) {
    // Unminted tokens stay uncached, so the page appears as soon as the token exists.
    res.status(error.missing ? 404 : 502).setHeader("Cache-Control", "no-store").send(error.missing ? "Not minted yet" : "Could not read the chain");
  }
}
