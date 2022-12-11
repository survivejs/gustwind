import { dir } from "../../utilities/fs.ts";
import { path } from "../../server-deps.ts";
import type { Plugin, PluginMeta, ProjectMeta, Scripts } from "../../types.ts";

const meta: PluginMeta = {
  name: "gustwind-script-plugin",
};

// TODO: Handle script compilation here as well
async function scriptPlugin(
  { scripts, scriptsPath }: {
    scripts: Scripts;
    // TODO: Model scripts output path here
    scriptsPath: string[];
  },
  projectMeta: ProjectMeta,
): Promise<Plugin> {
  const { outputDirectory } = projectMeta;
  const cwd = Deno.cwd();

  const foundScripts = (await Promise.all(
    scriptsPath.map((p) => dir(path.join(cwd, p), ".ts")),
  )).flat();
  let receivedScripts: { name: string; path: string }[] = [];

  return {
    prepareBuild: () => {
      return foundScripts.concat(receivedScripts).map((
        { name: scriptName, path: scriptPath },
      ) => ({
        type: "writeScript",
        payload: {
          outputDirectory,
          scriptName,
          scriptPath,
        },
      }));
    },
    prepareContext({ route }) {
      return {
        context: {
          scripts: scripts.concat(
            (foundScripts.concat(receivedScripts)).map((s) => ({
              type: "module",
              src: s.name.replace(".ts", ".js"),
            })),
          ).concat(route.scripts || []),
        },
      };
    },
    onMessage({ type, payload }) {
      if (type === "add-scripts") {
        // @ts-expect-error It's not clear how to type this
        receivedScripts = receivedScripts.concat(payload);
      } else {
        throw new Error(
          `gustwind-script-plugin - Unknown message type: ${type}`,
        );
      }
    },
  };
}

// TODO: Server
/*
      if (pathname.endsWith(".js")) {
        const matchedScript = cache.scripts[trim(pathname, "/")];

        if (matchedScript) {
          return respond(200, matchedScript, "text/javascript");
        }

        return respond(404, "No matching script");
      }
 */

export { meta, scriptPlugin as plugin };
