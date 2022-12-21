import { path } from "../../server-deps.ts";
import { getWebsocketServer } from "../../utilities/getWebSocketServer.ts";
import type { Plugin } from "../../types.ts";

const plugin: Plugin<{ wss: ReturnType<typeof getWebsocketServer> }> = {
  meta: {
    name: "websocket-plugin",
  },
  init: ({ mode, options: { wss } }) => {
    if (mode !== "development") {
      return {};
    }

    function sendMessage(message: { type: string; payload: unknown }) {
      wss.clients.forEach((socket) => {
        // 1 for open, https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
        if (socket.state === 1) {
          socket.send(JSON.stringify(message));
        }
      });
    }

    return {
      sendMessages: ({ send }) => {
        const cwd = Deno.cwd();
        const scriptsToCompile = ["webSocketClient"];

        send("gustwind-script-plugin", {
          type: "addScripts",
          payload: scriptsToCompile.map((name) => {
            const suffix = path.join(
              "plugins",
              "websocket",
              "scripts",
              `${name}.ts`,
            );

            return ({
              localPath: path.join(cwd, suffix),
              // TODO: It would be good to take gustwind version into account
              remotePath: path.join("https://deno.land/x/gustwind", suffix),
              name: `${name}.js`,
            });
          }),
        });
      },
      onMessage({ type }) {
        if (type === "fileChanged") {
          // TODO: How to tell apart ts + other cases in a nice way?
          // ts feels like the only exception since scripts get away
          // with replacing the script over a full refresh
          sendMessage({ type: "reloadPage", payload: {} });

          /*
              sendMessage({
                type: "replaceScript",
                payload: { name: `/${name}.js` },
              });
          */
        }
      },
    };
  },
};

export { plugin };