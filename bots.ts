import * as common from "./common";

const BOT_FPS = 60;
const EPS = 10;

interface Bot {
  ws: WebSocket;
  me: common.Player | undefined;
  goalX: number;
  goalY: number;
  timeoutBeforeTurn: number | undefined;
}

function createBot() {
  const bot: Bot = {
    ws: new WebSocket(`ws://localhost:${common.PORT}`),
    me: undefined,
    goalX: Math.random() * common.GAME_WIDTH,
    goalY: Math.random() * common.GAME_HEIGHT,
    timeoutBeforeTurn: undefined,
  };

  function turn() {
    if (bot.me) {
      let direction: common.Direction;

      for (direction in bot.me.moving) {
        if (bot.me.moving[direction]) {
          bot.me.moving[direction] = false;

          common.sendMessage<common.PlayerStartMoving>(bot.ws, {
            kind: common.MessageKind.PlayerStartMoving,
            start: false,
            direction,
          });
        }
      }

      bot.timeoutBeforeTurn = undefined;

      do {
        const dx = bot.goalX - bot.me.x;
        const dy = bot.goalY - bot.me.y;

        if (Math.abs(dx) > EPS) {
          if (dx > 0) {
            common.sendMessage<common.PlayerStartMoving>(bot.ws, {
              kind: common.MessageKind.PlayerStartMoving,
              start: true,
              direction: "right",
            });
          } else {
            common.sendMessage<common.PlayerStartMoving>(bot.ws, {
              kind: common.MessageKind.PlayerStartMoving,
              start: true,
              direction: "left",
            });
          }

          bot.timeoutBeforeTurn = Math.abs(dx) / common.PLAYER_SPEED;
        } else if (Math.abs(dy) > EPS) {
          if (dy > 0) {
            common.sendMessage<common.PlayerStartMoving>(bot.ws, {
              kind: common.MessageKind.PlayerStartMoving,
              start: true,
              direction: "down",
            });
          } else {
            common.sendMessage<common.PlayerStartMoving>(bot.ws, {
              kind: common.MessageKind.PlayerStartMoving,
              start: true,
              direction: "up",
            });
          }

          bot.timeoutBeforeTurn = Math.abs(dy) / common.PLAYER_SPEED;
        }

        if (bot.timeoutBeforeTurn === undefined) {
          bot.goalX = Math.random() * common.GAME_WIDTH;
          bot.goalY = Math.random() * common.GAME_HEIGHT;
        }
      } while (bot.timeoutBeforeTurn === undefined);
    }
  }

  bot.ws.addEventListener("message", (e) => {
    const data = JSON.parse(e.data);

    if (common.isWelcome(data)) {
      bot.me = {
        id: data.id,
        x: data.x,
        y: data.y,
        moving: data.moving,
        hue: data.hue,
      };

      turn();
    } else if (common.isPlayerMoving(data)) {
      if (bot.me && bot.me.id === data.id) {
        bot.me.x = data.x;
        bot.me.y = data.y;
        bot.me.moving[data.direction] = data.start;
      }
    }
  });

  // let previousTimestamp = 0;

  function tick() {
    // const timestamp = performance.now();
    const deltaTime = 1 / BOT_FPS;

    // previousTimestamp = timestamp;

    if (bot.timeoutBeforeTurn !== undefined) {
      bot.timeoutBeforeTurn -= deltaTime;

      if (bot.timeoutBeforeTurn <= 0) turn();
    }

    if (bot.me) common.updatePlayer(bot.me, deltaTime);

    setTimeout(tick, 1000 / BOT_FPS);
  }

  setTimeout(tick, 1000 / BOT_FPS);
}

for (let i = 0; i < 50; i++) {
  createBot();
}
