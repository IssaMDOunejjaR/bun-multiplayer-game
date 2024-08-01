import type { Server, ServerWebSocket } from "bun";
import * as common from "./common.ts";
import type { SocketData } from "./common.ts";

const SERVER_FPS = 60;
const STATS_AVERAGE_CAPACITY = 30;

let id = 0;
let bytesReceivedWitinTick = 0;

const stats = {
  tickTimes: new Array<number>(),
  startedAt: performance.now(),
  ticksCount: 0,
  messagesSent: 0,
  messagesRecieved: 0,
  tickMessagesSent: new Array<number>(),
  tickMessagesRecieved: new Array<number>(),
  bytesSent: 0,
  bytesReceived: 0,
  tickBytesSent: new Array<number>(),
  tickBytesReceived: new Array<number>(),
  playersJoined: 0,
  playersLeft: 0,
};

function average(arr: Array<number>): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function pushAverage(arr: Array<number>, n: number) {
  if (arr.push(n) > STATS_AVERAGE_CAPACITY) {
    arr.shift();
  }
}

function printStats() {
  console.clear();
  console.log("Stats:");
  console.log(" Ticks count:", stats.ticksCount);
  console.log(" Uptime (secs):", (performance.now() - stats.startedAt) / 1000);
  console.log(" Average time to process a tick:", average(stats.tickTimes));
  console.log(" Total messages sent:", stats.messagesSent);
  console.log(" Total messages recieved:", stats.messagesRecieved);
  console.log(
    " Average messages sent per tick:",
    average(stats.tickMessagesSent),
  );
  console.log(
    " Average messages recieved per tick:",
    average(stats.tickMessagesRecieved),
  );
  console.log(" Total bytes sent:", stats.bytesSent);
  console.log(" Total bytes recieved:", stats.bytesReceived);
  console.log(" Average bytes sent per tick:", average(stats.tickBytesSent));
  console.log(
    " Average bytes recieved per tick:",
    average(stats.tickBytesReceived),
  );
  console.log(" Current players:", joinedPlayers.size);
  console.log(" Players joined:", stats.playersJoined);
  console.log(" Players left:", stats.playersLeft);
}

function publish<T>(ws: ServerWebSocket<SocketData> | Server, message: T) {
  const data = JSON.stringify(message);

  ws.publish("game", data);

  return data.length * joinedPlayers.size;
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

function onConnect(ws: ServerWebSocket<SocketData>) {
  ws.subscribe("game");

  const joinedId = id++;

  ws.data = {
    id: joinedId,
  };

  const x = Math.random() * (common.GAME_WIDTH - common.PLAYER_SIZE);
  const y = Math.random() * (common.GAME_HEIGHT - common.PLAYER_SIZE);
  const hue = Math.floor(Math.random() * 360);
  const moving = {
    left: false,
    right: false,
    up: false,
    down: false,
  };

  joinedPlayers.set(joinedId, {
    ws,
    id: joinedId,
    x,
    y,
    moving,
    hue,
  });

  eventQueue.push({
    kind: common.MessageKind.Welcome,
    id: joinedId,
    x,
    y,
    hue,
  });

  eventQueue.push({
    kind: common.MessageKind.PlayerJoined,
    id: joinedId,
    x,
    y,
    moving,
    hue,
  });

  stats.messagesRecieved += 1;
  stats.playersJoined += 1;
}

function onDisconnect(ws: ServerWebSocket<SocketData>) {
  ws.unsubscribe("game");

  joinedPlayers.delete(ws.data.id);

  eventQueue.push({
    kind: common.MessageKind.PlayerLeft,
    id: ws.data.id,
  });

  stats.playersLeft += 1;
}

function onMessage(ws: ServerWebSocket<SocketData>, message: string) {
  stats.bytesReceived += message.length;
  stats.messagesRecieved += 1;
  bytesReceivedWitinTick += message.length;

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
    console.error(
      `Unknow message received from client with id ${ws.data.id}`,
      data,
    );
  }
}

let previousTimestamp = performance.now();

function tick() {
  const timestamp = performance.now();
  const deltaTime = (timestamp - previousTimestamp) / 1000;
  let messageCount = 0;
  let byteSentCount = 0;

  previousTimestamp = timestamp;

  eventQueue.forEach((event) => {
    switch (event.kind) {
      case common.MessageKind.Welcome:
        {
          const player = joinedPlayers.get(event.id);

          if (player) {
            const view = new DataView(
              new ArrayBuffer(common.WelcomeStruct.size),
            );

            common.WelcomeStruct.kind.write(
              view,
              0,
              common.MessageKind.Welcome,
            );
            common.WelcomeStruct.id.write(view, 0, event.id);
            common.WelcomeStruct.x.write(view, 0, event.x);
            common.WelcomeStruct.y.write(view, 0, event.y);
            common.WelcomeStruct.hue.write(
              view,
              0,
              Math.floor(event.hue / (360 * 256)),
            );

            player.ws.send(view);

            byteSentCount += view.byteLength;

            // byteSentCount += common.sendMessage<common.Welcome>(
            //   player.ws,
            //   event,
            // );
            messageCount += 1;
          }
        }
        break;
      case common.MessageKind.PlayerJoined:
        {
          const playerJoined = joinedPlayers.get(event.id);

          if (playerJoined) {
            joinedPlayers.forEach((otherPlayer) => {
              if (otherPlayer.id !== playerJoined.id) {
                byteSentCount += common.sendMessage<common.PlayerJoined>(
                  playerJoined.ws,
                  {
                    kind: common.MessageKind.PlayerJoined,
                    id: otherPlayer.id,
                    x: otherPlayer.x,
                    y: otherPlayer.y,
                    moving: otherPlayer.moving,
                    hue: otherPlayer.hue,
                  },
                );
                messageCount += 1;
              }
            });

            byteSentCount += publish<common.PlayerJoined>(playerJoined.ws, {
              kind: common.MessageKind.PlayerJoined,
              id: playerJoined.id,
              x: playerJoined.x,
              y: playerJoined.y,
              moving: playerJoined.moving,
              hue: playerJoined.hue,
            });

            messageCount += joinedPlayers.size;
          }
        }
        break;
      case common.MessageKind.PlayerMoving:
        {
          byteSentCount += publish(server, event);
          messageCount += joinedPlayers.size;
        }
        break;
      case common.MessageKind.PlayerLeft:
        {
          byteSentCount += publish(server, {
            kind: common.MessageKind.PlayerLeft,
            id: event.id,
          });
          messageCount += joinedPlayers.size;
        }
        break;
    }
  });

  joinedPlayers.forEach((player) => common.updatePlayer(player, deltaTime));

  stats.ticksCount += 1;
  pushAverage(stats.tickTimes, (performance.now() - timestamp) / 1000);
  stats.messagesSent += messageCount;
  pushAverage(stats.tickMessagesSent, messageCount);
  pushAverage(stats.tickMessagesRecieved, eventQueue.length);
  stats.bytesSent += byteSentCount;
  pushAverage(stats.tickBytesSent, byteSentCount);
  pushAverage(stats.tickBytesReceived, bytesReceivedWitinTick);

  eventQueue.length = 0;
  bytesReceivedWitinTick = 0;

  if (stats.ticksCount % SERVER_FPS === 0) {
    // printStats();
  }

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
