import { trim } from "../utilities/string.ts";
import type { Route } from "../types.ts";

function matchRoute(
  routes: Record<string, Route>,
  url: string,
): Route | undefined {
  if (!routes) {
    return;
  }

  const parts = trim(url, "/").split("/");
  const match = routes[url] || routes[parts[0]];

  console.log({ routes, parts, match, url });

  if (match && match.routes && parts.length > 1) {
    return matchRoute(match.routes, parts.slice(1).join("/"));
  }

  return match;
}

export { matchRoute };
