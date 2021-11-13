import { fs, path } from "../deps.ts";
import { getPageRenderer } from "./getPageRenderer.ts";
import type { BuildWorkerEvent, ProjectMeta } from "../types.ts";

let renderPage: ReturnType<typeof getPageRenderer>;
let projectMeta: ProjectMeta;

self.onmessage = async (e) => {
  const { type }: BuildWorkerEvent = e.data;

  if (type === "init") {
    const {
      payload: {
        components,
        projectMeta: meta,
      },
    } = e.data;

    projectMeta = meta;

    const twindSetup = meta.paths.twindSetup
      ? await import(meta.paths.twindSetup).then((m) => m.default)
      : {};
    renderPage = getPageRenderer({
      components,
      mode: "production",
      twindSetup,
    });
  }
  if (type === "build") {
    const {
      payload: {
        route,
        filePath,
        dir,
        extraContext,
        page,
      },
    } = e.data;
    const [html, js, context] = await renderPage({
      pathname: route,
      pagePath: filePath,
      page,
      extraContext,
      projectMeta,
    });

    await fs.ensureDir(dir).then(() => {
      if (projectMeta.features?.showEditorAlways) {
        Deno.writeTextFile(
          path.join(dir, "context.json"),
          JSON.stringify(context),
        );
        Deno.writeTextFile(
          path.join(dir, "definition.json"),
          JSON.stringify(page),
        );
      }

      Deno.writeTextFile(
        path.join(dir, "index.html"),
        html,
      );
      if (js) {
        Deno.writeTextFile(path.join(dir, "index.js"), js);
      }
    });
  }

  self.postMessage({});
};
