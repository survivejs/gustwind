import { install, tw } from "https://cdn.skypack.dev/@twind/core@1.1.1?min";
import presetTailwind from "https://esm.sh/@twind/preset-tailwind@1.1.1";
import breeze, { type Options } from "../../breezewind/mod.ts";
import * as breezeExtensions from "../../breezewind/extensions.ts";

install({ presets: [presetTailwind()], hash: false });

async function compileBreezewind(component: Options["component"]) {
  const components = await fetch("/components.json").then((res) => res.json());

  // TODO: Figure out how to handle component specific utilities (component.server.ts)
  // 1. Define a way to get the data from the server (implies bundling, how/where to handle?)
  // 2. Fetch component specific utilities (could be a single file with proper keying within)
  // 3. Attach utilities here (see templating code for an example)
  return breeze({
    component,
    components,
    context: {},
    extensions: [
      breezeExtensions.visibleIf,
      // @ts-expect-error This is fine
      breezeExtensions.classShortcut(tw),
      breezeExtensions.foreach,
    ],
  });
}

declare global {
  interface Window {
    compileBreezewind: typeof compileBreezewind;
  }
}

if (!("Deno" in globalThis)) {
  console.log("Hello from the component playground");

  window.compileBreezewind = compileBreezewind;
}
