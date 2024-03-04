import * as path from "node:path";
import { urlJoin } from "https://deno.land/x/url_join@1.0.0/mod.ts";
import type { Components, ComponentsEntry, GlobalUtilities } from "../types.ts";

const initLoader = (
  { cwd, loadDir, loadModule }: {
    cwd: string;
    loadDir: (
      { path, extension, recursive, type }: {
        path: string;
        extension: string;
        recursive: boolean;
        type: string;
      },
    ) => Promise<{ name: string; path: string }[]>;
    loadModule: (path: string) => Promise<GlobalUtilities>;
  },
) => {
  return async (
    componentsPath: string,
    selection?: string[],
  ): Promise<Components> => {
    const extension = ".html";
    let components = {};

    if (componentsPath.startsWith("http")) {
      if (!selection) {
        throw new Error("Remote loader is missing a selection");
      }

      components = await loadRemoteComponents(
        componentsPath,
        selection,
        extension,
      );
    } else {
      components = await Promise.all((await loadDir({
        path: path.join(cwd, componentsPath),
        extension,
        recursive: true,
        type: "components",
      })).map(async (
        { path: p },
      ) => {
        const componentName = path.basename(p, path.extname(p));
        let utilities;
        let utilitiesPath = p.replace(extension, ".server.ts");

        try {
          await Deno.lstat(p);

          utilities = await loadModule(utilitiesPath);
        } catch (_) {
          // No utilities were found so get rid of the path
          utilitiesPath = "";
        }

        // TODO: It might be a better idea to return utilities in a separate
        // data structure since they need to be extracted anyway and this
        // complicates getComponents due to an added lookup.
        return [
          componentName,
          {
            component: await Deno.readTextFile(p),
            utilities,
            utilitiesPath,
          },
        ];
      }));
    }

    return Object.fromEntries<ComponentsEntry>(
      // @ts-expect-error The type is wrong here. Likely htmToBreezewind needs a fix.
      components,
    );
  };
};

// TODO: Cache results to .gustwind to speed up operation
function loadRemoteComponents(
  componentsPath: string,
  selection: string[],
  extension: string,
) {
  return Promise.all(
    selection.map(async (componentName) => {
      let utilities;

      try {
        utilities = await import(
          urlJoin(componentsPath, componentName + ".server.ts")
        );
      } catch (_) {
        // Nothing to do
      }

      return [componentName, {
        component: await fetch(
          urlJoin(componentsPath, componentName + extension),
        ).then(
          (
            res,
          ) => res.text(),
        ),
        utilities,
      }];
    }),
  );
}

export { initLoader };