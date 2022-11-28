/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />
import { compileScript } from "../utilities/compileScripts.ts";
import { importPlugins } from "../utilities/plugins.ts";
import { importRender } from "../utilities/render.ts";
import { renderPage } from "../gustwind-utilities/renderPage.ts";
import { fs, nanoid, path } from "../server-deps.ts";
import type { Utilities } from "../breezewind/types.ts";
import type {
  BuildWorkerEvent,
  Components,
  DataSources,
  Plugin,
  ProjectMeta,
  Renderer,
} from "../types.ts";

let id: string;
let components: Components;
let dataSources: DataSources;
let projectMeta: ProjectMeta;
let pageUtilities: Utilities;
let render: Renderer["render"];
let plugins: Plugin[];

const DEBUG = Deno.env.get("DEBUG") === "1";

self.onmessage = async (e) => {
  const { type }: BuildWorkerEvent = e.data;

  if (type === "init") {
    id = nanoid();

    DEBUG && console.log("worker - starting to init", id);

    const { payload } = e.data;

    components = payload.components;
    projectMeta = payload.projectMeta;

    dataSources = projectMeta.paths.dataSources
      ? await import("file://" + projectMeta.paths.dataSources).then((m) => m)
      : {};

    pageUtilities = projectMeta.paths.pageUtilities
      ? await import("file://" + projectMeta.paths.pageUtilities).then((m) => m)
      : {};

    render = await importRender(projectMeta);

    // TODO: Load plugins + trigger them here for init
    plugins = await importPlugins(projectMeta);

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

    // TODO: Apply beforeEachRender
    plugins.forEach((plugin) =>
      plugin.beforeEachRender &&
      plugin.beforeEachRender({
        // TODO: context isn't correct yet as right now it's resolved
        // within renderPage. Maybe context resolution needs to be separated
        // because of this.
        context: { pagePath: url, ...route.context },
        layout,
        route,
        url,
      })
    );
    const { markup } = await renderPage({
      projectMeta,
      layout,
      route,
      mode: "production",
      pagePath: url,
      components,
      pageUtilities,
      pathname: url,
      dataSources,
      render,
    });
    // TODO: Apply afterEachRender

    if (route.type === "xml") {
      await Deno.writeTextFile(dir, markup);
    } else {
      await fs.ensureDir(dir);
      await Deno.writeTextFile(
        path.join(dir, "index.html"),
        markup,
      );
    }

    DEBUG && console.log("worker - finished build", id, route, filePath);
  }
  if (type === "writeScript") {
    const { payload: { outputDirectory, scriptName, scriptPath } } = e.data;

    await writeScript(outputDirectory, scriptName, scriptPath);
  }
  if (type === "writeFile") {
    const { payload: { outputDirectory, file, data } } = e.data;

    await fs.ensureDir(outputDirectory);
    await Deno.writeTextFile(path.join(outputDirectory, file), data);
  }
  if (type === "writeAssets") {
    const { payload: { outputPath, assetsPath } } = e.data;

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