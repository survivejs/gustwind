import { expandRoute, expandRoutes } from "./expandRoutes.ts";
import { flattenRoutes } from "./flattenRoutes.ts";
import { path } from "../../server-deps.ts";
import { trim } from "../../utilities/string.ts";
import type { DataSources, Plugin, Route, Tasks } from "../../types.ts";

type Routes = Record<string, Route>;

const plugin: Plugin<{
  dataSourcesPath: string;
  include: string[];
  routesPath: string;
  emitAllRoutes: boolean;
}> = {
  meta: {
    name: "breezewind-renderer-plugin",
    dependsOn: [],
  },
  init: async (
    {
      cwd,
      outputDirectory,
      options: { dataSourcesPath, include, routesPath, emitAllRoutes },
      load,
    },
  ) => {
    let routes = await loadRoutes();
    let dataSources = await loadDataSources();

    function loadRoutes() {
      return load.json<Routes>({
        path: path.join(cwd, routesPath),
        type: "routes",
      });
    }

    async function loadDataSources() {
      return dataSourcesPath
        ? await load.module<DataSources>({
          path: path.join(cwd, dataSourcesPath),
          type: "dataSources",
        })
        : {};
    }

    return {
      getAllRoutes: async () => {
        const { allRoutes } = await getAllRoutes(routes, dataSources);
        let includedRoutes = allRoutes;
        let tasks: Tasks = [];

        if (include) {
          includedRoutes = Object.fromEntries(
            Object.entries(
              allRoutes,
            ).filter(([url]) => include.includes(url)),
          );
        }

        if (emitAllRoutes) {
          tasks = [{
            type: "writeFile",
            payload: {
              outputDirectory,
              file: "routes.json",
              data: JSON.stringify(includedRoutes),
            },
          }];
        }

        return { routes: includedRoutes, tasks };
      },
      matchRoute: async (url: string) => {
        const { allRoutes } = await getAllRoutes(
          routes,
          dataSources,
        );
        const matchedRoute = matchRoute(allRoutes, url);

        if (matchedRoute) {
          const [_, route] = await expandRoute({
            url,
            route: matchedRoute,
            dataSources,
          });

          return { route, tasks: [] };
        }

        return { route: undefined, tasks: [] };
      },
      onMessage: async ({ message }) => {
        const { type, payload } = message;

        if (type === "fileChanged") {
          switch (payload.type) {
            case "routes": {
              routes = await loadRoutes();

              return { send: [{ type: "reloadPage" }] };
            }
            case "dataSources": {
              dataSources = await loadDataSources();

              return { send: [{ type: "reloadPage" }] };
            }
            case "paths": {
              return { send: [{ type: "reloadPage" }] };
            }
          }
        }
      },
    };
  },
};

async function getAllRoutes(routes: Routes, dataSources: DataSources) {
  const { allRoutes, allParameters } = await expandRoutes({
    routes,
    dataSources,
  });

  return { allRoutes: flattenRoutes(allRoutes), allParameters };
}

function matchRoute(
  routes: Record<string, Route>,
  url: string,
): Route | undefined {
  if (!routes) {
    return;
  }

  const parts = trim(url, "/").split("/");
  const match = routes[url] || routes[parts[0]];

  if (match && match.routes && parts.length > 1) {
    return matchRoute(match.routes, parts.slice(1).join("/"));
  }

  return match;
}

export { plugin };