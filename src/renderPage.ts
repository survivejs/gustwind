import {
  getStyleTag,
  getStyleTagProperties,
  virtualSheet,
} from "https://cdn.skypack.dev/twind@0.16.16/sheets?min";
import { setup as setupTwind } from "https://cdn.skypack.dev/twind@0.16.16?min";
import type {
  Components,
  DataContext,
  Layout,
  Meta,
  Mode,
  ProjectMeta,
  Route,
  Scripts,
} from "../types.ts";
import { getContext } from "./getContext.ts";
import { renderComponent } from "./renderComponent.ts";

const DEBUG = Deno.env.get("DEBUG") === "1";

const stylesheet = virtualSheet();

// TODO: Some kind of a lifecycle model would be useful to have here
// as it would allow decoupling twind from the core.
async function renderPage({
  projectMeta,
  layout,
  meta,
  route,
  scripts,
  hasScript,
  mode,
  pagePath,
  twindSetup,
  components,
  pathname,
}: {
  projectMeta: ProjectMeta;
  layout: Layout;
  route: Route;
  meta: Meta;
  scripts: Scripts;
  hasScript: boolean;
  mode: Mode;
  pagePath: string;
  twindSetup: Record<string, unknown>;
  components: Components;
  pathname: string;
}) {
  setupTwind({ sheet: stylesheet, mode: "silent", ...twindSetup });

  // @ts-ignore Somehow TS gets confused here
  stylesheet.reset();

  const projectPaths = projectMeta.paths;
  const pageContext: DataContext = await getContext(
    projectPaths.dataSources,
    projectPaths.transforms,
    route.dataSources,
  );
  const runtimeMeta: Meta = { built: (new Date()).toString() };

  const pageScripts = scripts?.slice(0) || [];

  if (hasScript) {
    scripts.push({ type: "module", src: "./index.js" });
  }
  if (mode === "development") {
    runtimeMeta.pagePath = pagePath;
    pageScripts.push({ type: "module", src: "/_webSocketClient.js" });
  }
  if (mode === "development" || projectMeta.features?.showEditorAlways) {
    pageScripts.push({ type: "module", src: "/_twindRuntime.js" });
    pageScripts.push({ type: "module", src: "/_toggleEditor.js" });
  }

  const context = {
    projectMeta,
    meta,
    scripts: pageScripts,
    ...pageContext,
  };

  DEBUG && console.log("rendering a page with context", context);

  const [headMarkup, bodyMarkup] = await Promise.all([
    renderHTML(
      projectPaths.transforms,
      layout.head,
      components,
      context,
      pathname,
    ),
    renderHTML(
      projectPaths.transforms,
      layout.body,
      components,
      context,
      pathname,
    ),
  ]);

  if (route.type === "xml") {
    return [xmlTemplate(bodyMarkup), context];
  }

  // https://web.dev/defer-non-critical-css/
  const styleTag = projectMeta.features?.extractCSS
    ? `<link rel="preload" href="./styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="styles.css"></noscript>`
    : getStyleTag(stylesheet);

  let css = "";
  if (projectMeta.features?.extractCSS) {
    css = getStyleTagProperties(stylesheet).textContent;
  }

  return [
    htmlTemplate(meta.language, headMarkup + styleTag, bodyMarkup),
    context,
    css,
  ];
}

function renderHTML(
  transformsPath: string,
  children: Layout["head"] | Layout["body"],
  components: Components,
  pageData: DataContext,
  pathname: string,
) {
  if (!children) {
    return "";
  }

  return renderComponent(
    transformsPath,
    { children },
    components,
    { ...pageData, pathname },
  );
}

function htmlTemplate(
  language: string,
  headMarkup: string,
  bodyMarkup: string,
) {
  return `<!DOCTYPE html><html lang="${language}"><head>${headMarkup}</head><body>${bodyMarkup}</body></html>`;
}

function xmlTemplate(bodyMarkup: string) {
  return `<?xml version="1.0" encoding="UTF-8" ?>${bodyMarkup}`;
}

export { renderHTML, renderPage };
