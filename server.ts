import type { ServerWebSocket } from "bun";
import * as common from "./common.ts";

const SERVER_FPS = 60;

let id = 0;

interface SocketData {
  id: number;
}

interface PlayerWithSocket extends common.Player {
  ws: ServerWebSocket<SocketData>;
}

type Event =
  | common.Welcome
  | common.PlayerJoined
  | common.PlayerLeft
  | common.PlayerMoving;

const eventQueue: Array<Event> = [];
const joinedPlayers = new Map<number, PlayerWithSocket>();

function randomStyle(): string {
  return `hsl(${Math.floor(Math.random() * 360)} 80% 50%)`;
}

function onConnect(ws: ServerWebSocket<SocketData>) {
  ws.subscribe("game");

  const joinedId = id++;

  ws.data = {
    id: joinedId,
  };

  const x = Math.random() * (common.GAME_WIDTH - common.PLAYER_SIZE);
  const y = Math.random() * (common.GAME_HEIGHT - common.PLAYER_SIZE);
  const hue = randomStyle();

  joinedPlayers.set(joinedId, {
    ws,
    id: joinedId,
    x,
    y,
    moving: {
      left: false,
      right: false,
      up: false,
      down: false,
    },
    hue,
  });

  eventQueue.push({
    kind: common.MessageKind.Welcome,
    id: joinedId,
  });

  eventQueue.push({
    kind: common.MessageKind.PlayerJoined,
    id: joinedId,
    x,
    y,
    hue,
  });
}

function onDisconnect(
  ws: ServerWebSocket<SocketData>,
  code: number,
  reason: string,
) {
  ws.unsubscribe("game");

  joinedPlayers.delete(ws.data.id);

  eventQueue.push({
    kind: common.MessageKind.PlayerLeft,
    id: ws.data.id,
  });
}

function onMessage(ws: ServerWebSocket<SocketData>, message: string) {
  const data = JSON.parse(message);

  if (common.isPlayerStartMoving(data)) {
    const player = joinedPlayers.get(ws.data.id);

    if (player) {
      player.moving[data.direction] = data.start;

      eventQueue.push({
        kind: common.MessageKind.PlayerMoving,
        id: ws.data.id,
        x: player.x,
        y: player.y,
        direction: data.direction,
        start: data.start,
      });
    }
  } else {
    console.error(`Unknow message received from player ${ws.data.id}`);
  }
}

let previousTimestamp = performance.now();

function tick() {
  const timestamp = performance.now();
  const deltaTime = (timestamp - previousTimestamp) / 1000;
  previousTimestamp = timestamp;

  eventQueue.forEach((event) => {
    switch (event.kind) {
      case common.MessageKind.Welcome:
        {
          const player = joinedPlayers.get(event.id);

          if (player) {
            player.ws.send(
              JSON.stringify({
                kind: common.MessageKind.Welcome,
                id: event.id,
              }),
            );
          }
        }
        break;
      case common.MessageKind.PlayerJoined:
        {
          const playerJoined = joinedPlayers.get(event.id);

          if (playerJoined) {
            joinedPlayers.forEach((otherPlayer) => {
              playerJoined.ws.send(
                JSON.stringify({
                  kind: common.MessageKind.PlayerJoined,
                  id: otherPlayer.id,
                  x: otherPlayer.x,
                  y: otherPlayer.y,
                  hue: otherPlayer.hue,
                }),
              );
            });

            server.publish(
              "game",
              JSON.stringify({
                kind: common.MessageKind.PlayerJoined,
                id: playerJoined.id,
                x: playerJoined.x,
                y: playerJoined.y,
                hue: playerJoined.hue,
              }),
            );
          }
        }
        break;
      case common.MessageKind.PlayerMoving:
        {
          server.publish("game", JSON.stringify(event));
        }
        break;
      case common.MessageKind.PlayerLeft:
        {
          server.publish(
            "game",
            JSON.stringify({
              kind: common.MessageKind.PlayerLeft,
              id: event.id,
            }),
          );
        }
        break;
    }
  });

  eventQueue.length = 0;

  joinedPlayers.forEach((player) => common.updatePlayer(player, deltaTime));

  setTimeout(tick, 1000 / SERVER_FPS);
}

setTimeout(tick, 1000 / SERVER_FPS);

const server = Bun.serve<SocketData>({
  fetch(request, server) {
    if (server.upgrade(request)) {
      return;
    }
  },
  websocket: {
    open: onConnect,
    close: onDisconnect,
    message: onMessage,
  },
  port: common.PORT,
});
