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

  ws.addEventListener("open", () => {});

  ws.addEventListener("message", (e: MessageEvent) => {
    if (e.data instanceof ArrayBuffer) {
      const view = new DataView(e.data);

      if (
        view.byteLength === common.WelcomeStruct.size &&
        common.WelcomeStruct.kind.read(view, 0) === common.MessageKind.Welcome
      ) {
        me = {
          id: common.WelcomeStruct.id.read(view, 0),
          x: common.WelcomeStruct.x.read(view, 0),
          y: common.WelcomeStruct.y.read(view, 0),
          moving: {
            left: false,
            right: false,
            up: false,
            down: false,
          },
          hue: (common.WelcomeStruct.hue.read(view, 0) / 256) * 360,
        };

        joinedPlayers.set(me.id, me);
      } else if (
        view.byteLength === common.PlayerJoinedStruct.size &&
        common.PlayerJoinedStruct.kind.read(view, 0) ===
          common.MessageKind.PlayerJoined
      ) {
        const id = common.PlayerJoinedStruct.id.read(view, 0);

        joinedPlayers.set(id, {
          id,
          x: common.PlayerJoinedStruct.x.read(view, 0),
          y: common.PlayerJoinedStruct.y.read(view, 0),
          moving: common.movingFromMask(
            common.PlayerJoinedStruct.moving.read(view, 0),
          ),
          hue: (common.PlayerJoinedStruct.hue.read(view, 0) / 256) * 360,
        });
      } else if (
        view.byteLength === common.PlayerMovingStruct.size &&
        common.PlayerMovingStruct.kind.read(view, 0) ===
          common.MessageKind.PlayerMoving
      ) {
        const id = common.PlayerMovingStruct.id.read(view, 0);
        const player = joinedPlayers.get(id);

        if (player) {
          player.x = common.PlayerMovingStruct.x.read(view, 0);
          player.y = common.PlayerMovingStruct.y.read(view, 0);
          player.moving = common.movingFromMask(
            common.PlayerMovingStruct.moving.read(view, 0),
          );
        }
      } else if (
        view.byteLength === common.PlayerLeftStruct.size &&
        common.PlayerLeftStruct.kind.read(view, 0) ===
          common.MessageKind.PlayerLeft
      ) {
        joinedPlayers.delete(common.PlayerLeftStruct.id.read(view, 0));
      }
    } else {
      console.error("Unknown message: ", e.data);
      ws?.close();
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
