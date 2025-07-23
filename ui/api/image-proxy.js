import fetch from "node-fetch";

export default async function handler(req, res) {
  console.log("[Image Proxy] Request received");
  const { imgUrl } = req.query;
  console.log(`[Image Proxy] Fetching image from: ${imgUrl}`);

  const response = await fetch(imgUrl);
  console.log(`[Image Proxy] Fetch response status: ${response.status}`);

  const buffer = await response.arrayBuffer();
  console.log(`[Image Proxy] Buffer size: ${buffer.byteLength} bytes`);

  const contentType = response.headers.get("content-type") || "image/jpeg";
  console.log(`[Image Proxy] Content-Type: ${contentType}`);

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");

  console.log("[Image Proxy] Sending image response");
  return res.send(Buffer.from(buffer));
}
