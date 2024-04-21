import * as path from "node:path";
import { expandRoutes } from "../expandRoutes.ts";
import { flattenRoutes } from "./flattenRoutes.ts";
import { matchRoute } from "../matchRoute.ts";
import { getDataSourceContext } from "../getDataSourceContext.ts";
import type {
  DataSources,
  DataSourcesModule,
  Plugin,
  Render,
  Route,
} from "../../types.ts";

type Routes = Record<string, Route>;

const plugin: Plugin<{
  dataSourcesPath: string;
  routesPath: string;
  emitAllRoutes: boolean;
}, { routes: Routes; dataSources: DataSources }> = {
  meta: {
    name: "config-router-plugin",
    description: "${name} implements a configuration based router.",
    dependsOn: [],
  },
  init(
    {
      cwd,
      outputDirectory,
      options: { dataSourcesPath, routesPath, emitAllRoutes },
      load,
      renderComponent,
    },
  ) {
    return {
      initPluginContext: async () => {
        const [routes, dataSources] = await Promise.all([
          loadRoutes(),
          loadDataSources(renderComponent),
        ]);

        return { routes, dataSources };
      },
      getAllRoutes: async ({ pluginContext }) => {
        const routes = await getAllRoutes(
          pluginContext.routes,
          pluginContext.dataSources,
        );

        return {
          routes,
          tasks: emitAllRoutes
            ? [{
              type: "writeTextFile",
              payload: {
                outputDirectory,
                file: "routes.json",
                data: JSON.stringify(routes),
              },
            }]
            : [],
        };
      },
      matchRoute: async (url: string, pluginContext) => {
        let route;

        try {
          route = await matchRoute(
            pluginContext.routes,
            url,
            pluginContext.dataSources,
          );

          // TODO: Check if tasks have to be returned
          return {
            route: {
              ...route,
              context: await getDataSourceContext(
                route.dataSources,
                pluginContext.dataSources,
              ),
            },
            tasks: [],
          };
        } catch (_error) {
          // This is fine since some routes are dynamic
        }

        return { route, tasks: [] };
      },
      onMessage: async ({ message }) => {
        const { type, payload } = message;

        if (type === "fileChanged") {
          switch (payload.type) {
            case "routes": {
              const routes = await loadRoutes();

              return {
                send: [{ type: "reloadPage", payload: undefined }],
                pluginContext: { routes },
              };
            }
            case "dataSources": {
              const dataSources = await loadDataSources(renderComponent);

              return {
                send: [{ type: "reloadPage", payload: undefined }],
                pluginContext: { dataSources },
              };
            }
            case "paths": {
              return { send: [{ type: "reloadPage", payload: undefined }] };
            }
          }
        }
      },
    };

    function loadRoutes() {
      return load.json<Routes>({
        path: path.join(cwd, routesPath),
        type: "routes",
      });
    }

    async function loadDataSources(render: Render) {
      return dataSourcesPath
        ? (await load.module<DataSourcesModule>({
          path: path.join(cwd, dataSourcesPath),
          type: "dataSources",
        })).init({ load, render })
        : {};
    }
  },
};

async function getAllRoutes(routes: Routes, dataSources: DataSources) {
  const allRoutes = await expandRoutes({
    routes,
    dataSources,
  });

  return flattenRoutes(allRoutes);
}

export { plugin };
