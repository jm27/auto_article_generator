import fetch from "node-fetch";

export default async function handler(req, res) {
  const { imgUrl } = req.query;
  const response = await fetch(imgUrl);
  const buffer = await response.arrayBuffer();
  res.setHeader(
    "Content-Type",
    response.headers.get("content-type") || "image/jpeg"
  );
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  return res.send(Buffer.from(buffer));
}
