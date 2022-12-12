import { path } from "../server-deps.ts";
import { getContext } from "./context.ts";
import type {
  Context,
  Mode,
  Plugin,
  PluginModule,
  PluginOptions,
  ProjectMeta,
  Route,
  Send,
  Tasks,
} from "../types.ts";

type LoadedPlugin = PluginModule & Plugin;
type LoadedPlugins = LoadedPlugin[];

async function importPlugins(
  { projectMeta, mode }: { projectMeta: ProjectMeta; mode: Mode },
) {
  const { plugins } = projectMeta;
  const loadedPlugins: PluginModule[] = [];

  // TODO: Probably this logic should be revisited to make it more robust
  // with dependency cycles etc.
  // TODO: Validate that all plugin dependencies exist in configuration
  for await (const pluginDefinition of plugins) {
    // TODO: Capture tasks here
    const { pluginModule } = await importPlugin({
      pluginDefinition,
      projectMeta,
      mode,
    });
    const { dependsOn } = pluginModule.meta;
    const dependencyIndex = loadedPlugins.findIndex(
      ({ meta: { name } }) => dependsOn?.includes(name),
    );

    // If there are dependencies, make sure the plugin is evaluated last
    if (dependencyIndex < 0) {
      loadedPlugins.unshift(pluginModule);
    } else {
      loadedPlugins.push(pluginModule);
    }
  }

  const tasks = await preparePlugins({ plugins: loadedPlugins });
  await applyOnTasksRegistered({ plugins: loadedPlugins, tasks });

  // The idea is to proxy routes from all routers so you can use multiple
  // routers or route definitions to aggregate everything together.
  const router = {
    // Last definition wins
    getAllRoutes() {
      return applyGetAllRoutes({ plugins: loadedPlugins });
    },
    // First match wins
    matchRoute(url: string) {
      return applyMatchRoutes({ plugins: loadedPlugins, url });
    },
  };

  return { tasks, plugins: loadedPlugins, router };
}

async function importPlugin({ pluginDefinition, projectMeta, mode }: {
  pluginDefinition: PluginOptions;
  projectMeta: ProjectMeta;
  mode: Mode;
}) {
  // TODO: Add logic against url based plugins
  const pluginPath = path.join(Deno.cwd(), pluginDefinition.path);
  const module = await import(pluginPath);
  // TODO: Inject registration logic here -> convert signature into an object
  // TODO: This should generate tasks to return as well and those should be
  // communicated further so the file watcher can register to watch.
  // The big question is how to reload a plugin (just re-execute?)
  const pluginApi = await module.plugin({
    mode,
    options: pluginDefinition.options,
    projectMeta,
  });

  return { pluginModule: { ...module, ...pluginApi } };
}

async function preparePlugins(
  { plugins }: { plugins: LoadedPlugins },
) {
  let tasks: Tasks = [];
  const messageSenders = plugins.map((plugin) => plugin.sendMessages)
    .filter(Boolean);
  const prepareBuilds = plugins.map((plugin) => plugin.prepareBuild)
    .filter(Boolean);
  const send = getSend(plugins);

  for await (const sendMessage of messageSenders) {
    if (sendMessage) {
      await sendMessage({ send });
    }
  }

  for await (const prepareBuild of prepareBuilds) {
    if (prepareBuild) {
      const tasksToAdd = await prepareBuild({ send });

      if (tasksToAdd) {
        tasks = tasks.concat(tasksToAdd);
      }
    }
  }

  return tasks;
}

async function applyPlugins(
  {
    plugins,
    mode,
    url,
    projectMeta,
    route,
  }: {
    mode: Mode;
    projectMeta: ProjectMeta;
    route: Route;
    plugins: LoadedPlugins;
    url: string;
  },
) {
  const send = getSend(plugins);
  const pluginContext = await applyPrepareContext({ plugins, send, route });

  const context = {
    ...(await getContext({
      mode,
      url,
      projectMeta,
      route,
    })),
    ...pluginContext,
  };

  const { tasks } = await applyBeforeEachRenders({
    context,
    plugins,
    route,
    send,
    url,
  });
  await applyOnTasksRegistered({ plugins, tasks });

  const markup = await applyRenders({
    context,
    plugins,
    route,
    send,
    url,
  });

  return {
    markup: await applyAfterEachRenders({
      context,
      markup,
      plugins,
      route,
      send,
      url,
    }),
    tasks,
  };
}

function getSend(plugins: LoadedPlugins): Send {
  return (pluginName, message) => {
    const foundPlugin = plugins.find(({ meta: { name } }) =>
      pluginName === name
    );

    if (foundPlugin) {
      if (foundPlugin.onMessage) {
        return foundPlugin.onMessage(message);
      } else {
        throw new Error(
          `Plugin ${pluginName} does not have an onMessage handler`,
        );
      }
    } else {
      throw new Error(
        `Tried to send a plugin (${pluginName}) that does not exist`,
      );
    }
  };
}

async function applyGetAllRoutes({ plugins }: { plugins: LoadedPlugins }) {
  const getAllRoutes = plugins.map((plugin) => plugin.getAllRoutes)
    .filter(Boolean);
  let ret: Record<string, Route> = {};

  for await (const routeGetter of getAllRoutes) {
    if (routeGetter) {
      const routes = await routeGetter();

      ret = { ...ret, ...routes };
    }
  }

  return ret;
}

async function applyMatchRoutes(
  { plugins, url }: { plugins: LoadedPlugins; url: string },
) {
  const matchRoutes = plugins.map((plugin) => plugin.matchRoute)
    .filter(Boolean);

  for await (const matchRoute of matchRoutes) {
    const matchedRoute = matchRoute && matchRoute(url);

    if (matchedRoute) {
      return matchedRoute;
    }
  }

  return false;
}

async function applyPrepareContext(
  { plugins, route, send }: {
    plugins: LoadedPlugins;
    route: Route;
    send: Send;
  },
) {
  let context = {};
  const prepareContexts = plugins.map((plugin) => plugin.prepareContext)
    .filter(Boolean);

  for await (const prepareContext of prepareContexts) {
    if (prepareContext) {
      const ret = await prepareContext({ send, route });

      if (ret?.context) {
        context = { ...context, ...ret.context };
      }
    }
  }

  return context;
}

async function applyBeforeEachRenders(
  { context, plugins, route, send, url }: {
    context: Context;
    plugins: LoadedPlugins;
    route: Route;
    send: Send;
    url: string;
  },
) {
  let tasks: Tasks = [];
  const beforeEachRenders = plugins.map((plugin) => plugin.beforeEachRender)
    .filter(Boolean);

  for await (const beforeEachRender of beforeEachRenders) {
    const tasksToAdd =
      // @ts-expect-error We know beforeEachRender should be defined by now
      await beforeEachRender({ context, route, send, url });

    if (tasksToAdd) {
      tasks = tasks.concat(tasksToAdd);
    }
  }

  return { tasks };
}

async function applyRenders(
  { context, plugins, route, send, url }: {
    context: Context;
    plugins: LoadedPlugins;
    route: Route;
    send: Send;
    url: string;
  },
) {
  const renders = plugins.map((plugin) => plugin.render)
    .filter(Boolean);
  let markup = "";

  // In the current design, we pick only the markup of the last renderer.
  // TODO: Does it even make sense to have multiple renderers in the system?
  for await (const render of renders) {
    markup =
      // @ts-expect-error We know render should be defined by now
      await render({ context, route, send, url });
  }

  return markup;
}

async function applyOnTasksRegistered(
  { plugins, tasks }: { plugins: LoadedPlugins; tasks: Tasks },
) {
  const tasksRegistered = plugins.map((plugin) => plugin.onTasksRegistered)
    .filter(Boolean);

  for await (const cb of tasksRegistered) {
    if (cb) {
      await cb(tasks);
    }
  }
}

async function applyAfterEachRenders(
  { context, markup, plugins, route, send, url }: {
    context: Context;
    markup: string;
    plugins: LoadedPlugins;
    route: Route;
    send: Send;
    url: string;
  },
) {
  const afterEachRenders = plugins.map((plugin) => plugin.afterEachRender)
    .filter(Boolean);
  for await (const afterEachRender of afterEachRenders) {
    // TODO: Later on this should be able to create new tasks to run
    // @ts-expect-error We know afterEachRender should be defined by now
    const { markup: updatedMarkup } = await afterEachRender({
      context,
      markup,
      route,
      send,
      url,
    });

    markup = updatedMarkup;
  }

  return markup;
}

export {
  applyAfterEachRenders,
  applyBeforeEachRenders,
  applyPlugins,
  applyPrepareContext,
  applyRenders,
  importPlugin,
  importPlugins,
  preparePlugins,
};
