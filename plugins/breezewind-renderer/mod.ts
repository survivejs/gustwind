import { tw } from "https://esm.sh/@twind/core@1.1.1";
import { path } from "../../server-deps.ts";
import { getDefinitions } from "../../gustwind-utilities/getDefinitions.ts";
import breezewind from "../../breezewind/index.ts";
import { applyUtilities } from "../../breezewind/applyUtility.ts";
import * as breezeExtensions from "../../breezewind/extensions.ts";
import { defaultUtilities } from "../../breezewind/defaultUtilities.ts";
import type { Component, Utilities } from "../../breezewind/types.ts";
import type { Plugin, Routes } from "../../types.ts";

type PageUtilities = {
  init: ({ routes }: { routes: Routes }) => Utilities;
};

const plugin: Plugin<{
  componentPaths: string[];
  metaPath: string;
  pageUtilitiesPath: string;
}> = {
  meta: {
    name: "breezewind-renderer-plugin",
    dependsOn: ["gustwind-twind-plugin"],
  },
  init: async ({
    cwd,
    options: { componentPaths, metaPath, pageUtilitiesPath },
    load,
    mode,
  }) => {
    let [components, pageUtilities, meta] = await Promise.all([
      loadComponents(),
      loadPageUtilities(),
      loadMeta(),
    ]);

    async function loadComponents() {
      // Collect components from different directories
      const components = await Promise.all(
        componentPaths.map(async (componentsPath) =>
          getDefinitions<Component>(
            await load.dir({
              path: path.join(cwd, componentsPath),
              extension: ".json",
              recursive: true,
              type: "components",
            }),
          )
        ),
      );

      // Aggregate components together as a single collection
      return Object.assign.apply(
        undefined,
        // @ts-expect-error This is fine. There's some type weirdness going on.
        components,
      );
    }

    async function loadPageUtilities() {
      return pageUtilitiesPath
        ? await load.module<PageUtilities>({
          path: path.join(cwd, pageUtilitiesPath),
          type: "pageUtilities",
        })
        : undefined;
    }

    function loadMeta() {
      return metaPath ? load.json({ path: metaPath, type: "meta" }) : {};
    }

    return {
      prepareContext: async ({ url, route }) => {
        const runtimeMeta: Record<string, string> = {
          built: (new Date()).toString(),
        };

        // TODO: Rename pagePath as url across the project?
        if (mode === "development") {
          runtimeMeta.pagePath = url;
        }

        const context = {
          ...runtimeMeta,
          ...meta,
          ...route.meta,
          ...route.context,
        };

        return {
          context: {
            ...context,
            pagePath: url,
            meta: await applyUtilities(
              context,
              // @ts-expect-error This is ok
              defaultUtilities,
              { context },
            ),
          },
        };
      },
      render: ({ routes, route, context }) =>
        renderHTML({
          component: components[route.layout],
          components,
          context,
          utilities: pageUtilities && pageUtilities.init({ routes }),
        }),
      onMessage: async ({ message }) => {
        const { type, payload } = message;

        switch (type) {
          case "fileChanged": {
            switch (payload.type) {
              case "components": {
                components = await loadComponents();

                return { send: [{ type: "reloadPage" }] };
              }
              case "pageUtilities": {
                pageUtilities = await loadPageUtilities();

                return { send: [{ type: "reloadPage" }] };
              }
              case "meta": {
                meta = await loadMeta();

                return { send: [{ type: "reloadPage" }] };
              }
              case "paths": {
                return { send: [{ type: "reloadPage" }] };
              }
            }
            return;
          }
          case "getComponents":
            return components;
          case "getRenderer":
            return components[payload];
          case "updateComponents":
            components = payload;
            break;
        }
      },
    };
  },
};

function renderHTML(
  { component, components, context, utilities }: Parameters<
    typeof breezewind
  >[0],
) {
  return breezewind({
    component,
    components,
    extensions: [
      // It's important visibleIf evaluates before the others to avoid work
      breezeExtensions.visibleIf,
      // TODO: Allow defining these through configuration
      breezeExtensions.classShortcut(tw),
      breezeExtensions.foreach,
    ],
    context,
    utilities,
  });
}

export { plugin, renderHTML };
