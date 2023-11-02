import type { Utilities } from "../breezewind/types.ts";
import type { Components } from "../utilities/loaders.ts";
import type { PageUtilities, Routes } from "../types.ts";

// https://stackoverflow.com/a/47636222/228885
function getComponentUtilities(
  components: Components,
  routes: Routes,
): Record<string, Utilities> {
  return Object.fromEntries(
    Object.entries(components).map(([k, v]) =>
      v.utilities && [k, v.utilities.init({ routes })]
    )
      .filter(<T>(n?: T): n is T => Boolean(n)),
  );
}

function getGlobalUtilities(
  pageUtilities: PageUtilities,
  components: Components,
  routes: Routes,
  layout: string,
) {
  const ret = pageUtilities.init({ routes });

  // Expose layout-specific utilities as global utilities
  if (components[layout]) {
    return { ...ret, ...components[layout]?.utilities?.init({ routes }) };
  }

  return ret;
}

export { getComponentUtilities, getGlobalUtilities };
