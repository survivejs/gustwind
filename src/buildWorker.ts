/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />
import { nanoid } from "https://cdn.skypack.dev/nanoid@3.1.30?min";
import { compileScript } from "../utils/compileScripts.ts";
import { fs, path } from "../server-deps.ts";
import { renderPage } from "./renderPage.ts";
import type { BuildWorkerEvent, Components, ProjectMeta } from "../types.ts";

let id: string;
let components: Components;
let projectMeta: ProjectMeta;
let pageUtilities: Record<string, unknown>;
let twindSetup: Record<string, unknown>;

const DEBUG = Deno.env.get("DEBUG") === "1";

self.onmessage = async (e) => {
  const { type }: BuildWorkerEvent = e.data;

  if (type === "init") {
    id = nanoid();

    DEBUG && console.log("worker - starting to init", id);

    const { payload } = e.data;

    components = payload.components;
    projectMeta = payload.projectMeta;

    pageUtilities = projectMeta.paths.pageUtilities
      ? await import("file://" + projectMeta.paths.pageUtilities).then((m) => m)
      : {};

    twindSetup = projectMeta.paths.twindSetup
      ? await import("file://" + projectMeta.paths.twindSetup).then((m) =>
        m.default
      )
      : {};

    DEBUG && console.log("worker - finished init", id);
  }
  if (type === "build") {
    const {
      payload: {
        layout,
        route,
        filePath,
        dir,
        url,
      },
    } = e.data;

    DEBUG && console.log("worker - starting to build", id, route, filePath);

    const [html, context, css] = await renderPage({
      projectMeta,
      layout,
      route,
      mode: "production",
      pagePath: "", // TODO
      twindSetup,
      components,
      pageUtilities,
      pathname: url,
    });

    if (css) {
      // TODO: Push this to a task
      await Deno.writeTextFile(path.join(dir, "styles.css"), css);
    }

    if (route.type !== "xml" && projectMeta.features?.showEditorAlways) {
      // TODO: Can these be pushed to tasks?
      await fs.ensureDir(dir);
      await Deno.writeTextFile(
        path.join(dir, "context.json"),
        JSON.stringify(context),
      );
      await Deno.writeTextFile(
        path.join(dir, "layout.json"),
        JSON.stringify(layout),
      );
      await Deno.writeTextFile(
        path.join(dir, "route.json"),
        JSON.stringify(route),
      );
    }

    if (route.type === "xml") {
      await Deno.writeTextFile(dir, html);
    } else {
      await fs.ensureDir(dir);
      await Deno.writeTextFile(
        path.join(dir, "index.html"),
        html,
      );
    }

    DEBUG && console.log("worker - finished build", id, route, filePath);
  }
  if (type === "writeScript") {
    const {
      payload: {
        outputDirectory,
        scriptName,
        scriptPath,
      },
    } = e.data;

    await writeScript(outputDirectory, scriptName, scriptPath);
  }
  if (type === "writeFile") {
    const {
      payload: {
        dir,
        file,
        data,
      },
    } = e.data;

    await fs.ensureDir(dir);
    await Deno.writeTextFile(path.join(dir, file), data);
  }
  if (type === "writeAssets") {
    const {
      payload: {
        outputPath,
        assetsPath,
      },
    } = e.data;

    await fs.copy(assetsPath, outputPath, { overwrite: true });
  }

  self.postMessage({});
};

async function writeScript(
  outputPath: string,
  scriptName: string,
  scriptDirectory?: string,
) {
  if (!scriptDirectory) {
    return Promise.resolve();
  }

  const script = await compileScript({
    path: scriptDirectory,
    name: scriptName,
    mode: "production",
  });
  const scriptPath = path.join(outputPath, scriptName.replace(".ts", ".js"));

  DEBUG && console.log("writing script", scriptPath);

  return Deno.writeTextFile(scriptPath, script.content);
}
