import * as common from "./common";

(async function () {
  const canvas = document.getElementById("game") as HTMLCanvasElement | null;

  if (!canvas) throw new Error("No element by id 'game'");

  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("No support for 2d");

  ctx.canvas.width = common.GAME_WIDTH;
  ctx.canvas.height = common.GAME_HEIGHT;

  let ws: WebSocket | undefined = new WebSocket(
    `ws://localhost:${common.PORT}/`,
  );

  let me: common.Player | undefined;

  ws.binaryType = "arraybuffer";

  const joinedPlayers = new Map<number, common.Player>();

  ws.addEventListener("open", () => { });

  ws.addEventListener("message", (e: MessageEvent) => {
    // console.log(e.data);
    // if (e.data instanceof ArrayBuffer) {
    //   const view = new DataView(e.data);
    //
    //   console.log(view.getUint8(0));
    // }
    // return;
    const data = JSON.parse(e.data);

    if (common.isWelcome(data)) {
      me = {
        id: data.id,
        x: data.x,
        y: data.y,
        moving: data.moving,
        hue: data.hue,
      };

      joinedPlayers.set(data.id, me);
    } else if (common.isPlayerJoined(data)) {
      joinedPlayers.set(data.id, {
        id: data.id,
        x: data.x,
        y: data.y,
        moving: {
          left: false,
          right: false,
          up: false,
          down: false,
        },
        hue: data.hue,
      });
    } else if (common.isPlayerMoving(data)) {
      const player = joinedPlayers.get(data.id);

      if (player) {
        player.x = data.x;
        player.y = data.y;
        player.moving[data.direction] = data.start;
      }
    } else if (common.isPlayerLeft(data)) {
      joinedPlayers.delete(data.id);
    } else {
      console.error("Unknown message: ", data);
    }
  });

  ws.addEventListener("close", () => {
    ws = undefined;
  });

  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (ws) {
      const direction = common.DIRECTONS_KEYS[e.key];

      if (direction !== undefined) {
        common.sendMessage<common.PlayerStartMoving>(ws, {
          kind: common.MessageKind.PlayerStartMoving,
          start: true,
          direction,
        });
      }
    }
  });

  document.addEventListener("keyup", (e: KeyboardEvent) => {
    if (ws) {
      const direction = common.DIRECTONS_KEYS[e.key];

      if (direction !== undefined) {
        common.sendMessage<common.PlayerStartMoving>(ws, {
          kind: common.MessageKind.PlayerStartMoving,
          start: false,
          direction,
        });
      }
    }
  });

  let previousTimestamp = 0;

  const frame = (timestamp: number) => {
    const deltaTime = (timestamp - previousTimestamp) / 1000;
    previousTimestamp = timestamp;

    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (!ws) {
      const label = "Disconnected";
      const size = ctx.measureText(label);

      ctx.font = "48px bold";
      ctx.fillStyle = "white";

      ctx.fillText(
        label,
        ctx.canvas.width / 2 - size.width / 2,
        ctx.canvas.height / 2,
      );
    } else {
      joinedPlayers.forEach((player) => {
        common.updatePlayer(player, deltaTime);

        ctx.fillStyle = `hsl(${player.hue} 70% 40%)`;

        ctx.fillRect(
          player.x,
          player.y,
          common.PLAYER_SIZE,
          common.PLAYER_SIZE,
        );
      });

      if (me) {
        ctx.fillStyle = `hsl(${me.hue} 100% 40%)`;
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;

        ctx.fillRect(me.x, me.y, common.PLAYER_SIZE, common.PLAYER_SIZE);

        ctx.strokeRect(me.x, me.y, common.PLAYER_SIZE, common.PLAYER_SIZE);
      }
    }

    window.requestAnimationFrame(frame);
  };

  window.requestAnimationFrame(frame);
})();
