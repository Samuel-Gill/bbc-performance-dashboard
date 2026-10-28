import { readFile } from "node:fs/promises";
import { createHash, timingSafeEqual } from "node:crypto";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method !== "GET") {
    response.statusCode = 405;
    response.end("Method not allowed");
    return;
  }
  const password = process.env.BBC_WORKBOOK_PASSWORD;
  if (!password) {
    response.statusCode = 503;
    response.end(
      "Set BBC_WORKBOOK_PASSWORD in Vercel to enable the included church workbook. You can still upload Excel directly.",
    );
    return;
  }
  const provided = (request.headers.authorization || "").replace(
    /^Bearer /,
    "",
  );
  const hash = (value) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(provided), hash(password))) {
    response.statusCode = 401;
    response.end(
      "Enter the workbook password to load the included church data.",
    );
    return;
  }
  try {
    const bytes = await readFile(
      new URL("../private/starter.xlsx", import.meta.url),
    );
    response.statusCode = 200;
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.end(bytes);
  } catch {
    response.statusCode = 500;
    response.end(
      "The included workbook could not be read. Upload your Excel copy instead.",
    );
  }
}
