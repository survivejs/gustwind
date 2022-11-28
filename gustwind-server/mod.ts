import { cache, lookup, path as _path, Server } from "../server-deps.ts";
import { compileScript, compileScripts } from "../utilities/compileScripts.ts";
import { getJson, resolvePaths } from "../utilities/fs.ts";
import { trim } from "../utilities/string.ts";
import { getDefinitions } from "../gustwind-utilities/getDefinitions.ts";
import { expandRoutes } from "../gustwind-utilities/expandRoutes.ts";
import { respond } from "../gustwind-utilities/respond.ts";
import {
  applyAfterEachRenders,
  applyBeforeEachRenders,
  applyPrepareBuilds,
  importPlugins,
} from "../gustwind-utilities/plugins.ts";
import { getCache, type ServeCache } from "./cache.ts";
import type {
  DataSources,
  Layout,
  Mode,
  ProjectMeta,
  Route,
} from "../types.ts";
import type { Component } from "../breezewind/types.ts";

const DEBUG = Deno.env.get("DEBUG") === "1";

async function serveGustwind({
  projectMeta,
  projectRoot,
  mode,
  initialCache,
  dataSources,
}: {
  projectMeta: ProjectMeta;
  projectRoot: string;
  mode: Mode;
  initialCache?: ServeCache;
  dataSources: DataSources;
}) {
  // The cache is populated based on an external source (web socket, fs). If there's
  // something in the cache, then the routing logic will refer to it instead of
  // the original entries loaded from the file system.
  const cache = initialCache || getCache();
  const assetsPath = projectMeta.paths.assets;
  projectMeta.paths = resolvePaths(projectRoot, projectMeta.paths);

  const projectPaths = projectMeta.paths;

  const [routes, layouts, components] = await Promise.all([
    getJson<Record<string, Route>>(projectPaths.routes),
    getDefinitions<Component | Component[]>(projectPaths.layouts),
    getDefinitions<Component>(projectPaths.components),
  ]);

  cache.routes = await expandRoutes({
    routes,
    dataSources,
  });

  const plugins = await importPlugins(projectMeta);
  const pluginTasks = await applyPrepareBuilds({ plugins, components });

  // TODO: Handle tasks (i.e., implement writeScript)
  console.log("dev - plugin tasks", pluginTasks);

  /*
  if (mode === "development") {
    // TODO: This branch might be safe to eliminate since
    // meta.json scripts is capturing the dev scripts.
    if (import.meta.url.startsWith("file:///")) {
      DEBUG && console.log("Compiling local scripts");

      cache.scripts = await compileScriptsToJavaScript(
        _path.join(
          _path.dirname(_path.fromFileUrl(import.meta.url)),
          "..",
          "scripts",
        ),
      );
    } else {
      DEBUG && console.log("Compiling remote scripts");

      cache.scripts = Object.fromEntries(
        // TODO: Pull custom scripts from plugins to compile here
        (await compileRemoteGustwindScripts("https://deno.land/x/gustwind", []))
          .map(
            ({ name, content }) => {
              return [name.replace(".ts", ".js"), content];
            },
          ),
      );
    }
  }
  */

  // TODO: This should get handled by the editor plugin
  /*
  if (projectPaths.twindSetup) {
    DEBUG && console.log("Compiling project twind setup");

    const name = "twindSetup.js";

    cache.scripts[name] = (await compileScript({
      path: projectPaths.twindSetup,
      name,
      mode: "development",
    })).content;
  }
  */

  if (projectPaths.scripts) {
    DEBUG && console.log("Compiling project scripts");

    const customScripts = Object.fromEntries(
      (await Promise.all(
        projectPaths.scripts.map(async (s) =>
          Object.entries(await compileScriptsToJavaScript(s))
        ),
      )).flat(),
    );

    cache.scripts = { ...cache.scripts, ...customScripts };
  }

  // TODO: This should get handled by the editor plugin
  /*
  if (projectPaths.transforms) {
    DEBUG && console.log("Compiling project transforms");

    const transformScripts = await compileScriptsToJavaScript(
      projectPaths.transforms,
    );

    cache.scripts = { ...cache.scripts, ...transformScripts };
  }
  */

  const server = new Server({
    handler: async ({ url }) => {
      // TODO: Trigger beforeEachRequest here
      const { pathname } = new URL(url);
      const matchedRoute = matchRoute(cache.routes, pathname);

      if (matchedRoute) {
        const layoutName = matchedRoute.layout;

        if (!layoutName) {
          return respond(404, "No matching layout");
        }

        const matchedLayout = layouts[layoutName];

        if (matchedLayout) {
          const route = matchedRoute; // TODO: Cache?

          let contentType = "text/html; charset=utf-8";

          // TODO: Trigger beforeEachRequest for each plugin here

          // If there's cached data, use it instead. This fixes
          // the case in which there was an update over  a websocket and
          // also avoids the need to hit the file system for getting
          // the latest data.
          const layout: Layout = cache.layouts[layoutName] ||
            matchedLayout;

          // TODO: Store context so that subsequent requests can find the data
          // TODO: Redo this so that plugin hooks get applied
          /*
          const { markup, context } = await renderPage({
            projectMeta,
            layout,
            route,
            mode,
            pagePath: pathname,
            components,
            pageUtilities: cache.pageUtilities,
            dataSources,
            // TODO
            render: {},
          });
          */
          const markup = "";

          if (matchedRoute.type === "xml") {
            // https://stackoverflow.com/questions/595616/what-is-the-correct-mime-type-to-use-for-an-rss-feed
            contentType = "text/xml";
          }

          return respond(200, markup, contentType);
        }

        return respond(404, "No matching layout");
      }

      const assetPath = projectPaths.assets && _path.join(
        projectPaths.assets,
        _path.relative(assetsPath || "", trim(pathname, "/")),
      );

      try {
        if (assetPath) {
          const asset = await Deno.readFile(assetPath);

          return respond(200, asset, lookup(assetPath));
        }
      } catch (_error) {
        // TODO: What to do with possible errors?
        DEBUG && console.error(_error);
      }

      if (pathname.endsWith(".js")) {
        const matchedScript = cache.scripts[trim(pathname, "/")];

        if (matchedScript) {
          return respond(200, matchedScript, "text/javascript");
        }

        return respond(404, "No matching script");
      }

      return respond(404, "No matching route");
    },
  });
  const listener = Deno.listen({ port: projectMeta.port });

  return () => server.serve(listener);
}

function matchRoute(
  routes: Route["routes"],
  pathname: string,
): Route | undefined {
  if (!routes) {
    return;
  }

  const parts = trim(pathname, "/").split("/");
  const match = routes[pathname] || routes[parts[0]];

  if (match && match.routes && parts.length > 1) {
    return matchRoute(match.routes, parts.slice(1).join("/"));
  }

  return match;
}

function compileRemoteGustwindScripts(repository: string, scripts: string[]) {
  const scriptsDirectory = "gustwind-scripts";

  return Promise.all(scripts.map(async (script) => {
    const { path } = await cache(
      `${repository}/${scriptsDirectory}/${script}`,
    );
    // TODO: Validate this one
    const name = script.split(".")[0];

    return compileScript({ name, path, mode: "development" });
  }));
}

async function compileScriptsToJavaScript(path: string) {
  try {
    return Object.fromEntries(
      (await compileScripts(path, "development")).map(
        ({ name, content }) => {
          return [name.replace(".ts", ".js"), content];
        },
      ),
    );
  } catch (error) {
    DEBUG && console.error(error);

    // If the scripts directory doesn't exist or something else goes wrong,
    // above might throw
    return {};
  }
}

export { serveGustwind };
