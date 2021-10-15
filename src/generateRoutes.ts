import { dir, get, getJsonSync, zipToObject } from "./utils.ts";
import type { DataContext, Meta, Page, SiteMeta } from "../types.ts";
import transform from "./transform.ts";

async function generateRoutes(
  { renderPage, pagesPath, siteMeta }: {
    renderPage: (
      route: string,
      path: string,
      data: Record<string, unknown>,
      page: Page,
    ) => void;
    pagesPath: string;
    siteMeta: SiteMeta;
  },
) {
  const pages = (await dir(pagesPath, ".json")).map((meta) => ({
    meta,
    // TODO: Can this become async?
    page: getJsonSync<Page>(meta.path) as Page,
  }));
  const paths: Record<
    string,
    { route: string; context: Record<string, unknown>; page: Page }
  > = {};
  const routes: string[] = [];

  await Promise.all(pages.map(async ({ page, meta: { name, path } }) => {
    const { dataSources, matchBy } = page;
    let rootPath = name.split(".").slice(0, -1).join(".");
    rootPath = rootPath === "index" ? "" : rootPath;

    if (dataSources) {
      await Promise.all(
        // @ts-ignore: Figure out how the type
        dataSources.map(({ id, operation, input, transformWith }) =>
          import(`../dataSources/${operation}.ts`).then(async (o) => (
            [id, await transform(transformWith, await o.default(input))]
          ))
        ),
      ).then((
        dataSources,
      ) => {
        const pageData = zipToObject<{ dataSource: { id: string } }>(
          // @ts-ignore Figure out the type
          dataSources,
        );

        if (rootPath.startsWith("[") && rootPath.endsWith("]")) {
          const routerPath = rootPath.slice(1, -1);

          if (matchBy) {
            const dataSource = pageData[matchBy.dataSource];

            Object.values(dataSource).forEach((v) => {
              const route = `/${routerPath}/${v.id}`;
              const context = { ...pageData, match: v };

              renderPage(
                route,
                path,
                context,
                page,
              );

              paths[path] = {
                route,
                context,
                page: { ...page, meta: getMeta(pageData, page.meta, siteMeta) },
              };
              routes.push(route);
            });
          } else {
            console.warn(`Path ${rootPath} is missing a matchBy`);
          }
        } else {
          const route = `/${rootPath}`;

          renderPage(route, path, pageData, page);

          paths[path] = {
            route,
            context: pageData,
            page: { ...page, meta: getMeta(pageData, page.meta, siteMeta) },
          };
          routes.push(route);
        }
      });
    } else {
      const route = `/${rootPath}`;
      const pageData = {};

      renderPage(route, path, {}, page);

      paths[path] = {
        route,
        context: pageData,
        page: { ...page, meta: getMeta(pageData, page.meta, siteMeta) },
      };
      routes.push(route);
    }
  }));

  return { paths, routes };
}

function getMeta(
  pageData: DataContext,
  meta: Meta,
  siteMeta: SiteMeta,
) {
  return {
    ...applyMeta(meta, pageData),
    "og:site_name": siteMeta.siteName || "",
    "twitter:site": siteMeta.siteName || "",
    "og:title": meta.title || "",
    "twitter:title": meta.title || "",
    "og:description": meta.description || "",
    "twitter:description": meta.description || "",
  };
}

function applyMeta(meta: Meta, dataContext?: DataContext) {
  const ret: Meta = {};

  Object.entries(meta).forEach(([k, v]) => {
    if (k.startsWith("__") && dataContext) {
      ret[k.slice(2)] = get<DataContext>(dataContext, v);
    } else {
      ret[k] = v;
    }
  });

  return ret;
}

export { generateRoutes };
