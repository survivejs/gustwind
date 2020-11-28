import { Application } from "./deps.ts";

async function serve(port: number) {
  const app = new Application();

  console.log(`Serving at ${port}`);

  app.use((context) => {
    context.response.headers.set("Content-Type", "text/html; charset=UTF-8");
    context.response.body = new TextEncoder().encode(
      htmlTemplate({ title: "Gustwind", body: "Hello world" }),
    );
  });

  await app.listen({ port });
}

type Meta = Record<string, string>;

function htmlTemplate(
  { title, meta, head, body }: {
    title: string;
    meta?: Meta;
    styleTag?: string;
    head?: string;
    body?: string;
  },
) {
  return `<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title || ""}</title>
    ${generateMeta(meta)}
    ${head || ""}
  </head>
  <body>${body || ""}</body>
</html>`;
}

function generateMeta(meta?: Meta) {
  if (!meta) {
    return "";
  }

  return Object.entries(meta).map(([key, value]) =>
    `<meta name="${key}" content="${value}"></meta>`
  ).join("\n");
}

// TODO: Make this configurable
const port = 3000;

serve(port);
