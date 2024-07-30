import * as common from "./common";

const ws = new WebSocket(`http://localhost:${common.PORT}/`);

(async function () {
  const canvas = document.getElementById("game") as HTMLCanvasElement | null;

  if (!canvas) throw new Error("No element by id 'game'");

  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("No support for 2d");

  const joinedPlayers = new Map<number, common.Player>();

  ctx.canvas.width = common.GAME_WIDTH;
  ctx.canvas.height = common.GAME_HEIGHT;

  ws.addEventListener("open", () => {
    let id: number;

    ws.addEventListener("message", (e: MessageEvent) => {
      const data = JSON.parse(e.data);

      if (common.isWelcome(data)) {
        id = data.id;
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
        console.error("Unknown message");
      }
    });

    ws.addEventListener("close", () => {
      joinedPlayers.clear();
    });

    document.addEventListener("keydown", (e: KeyboardEvent) => {
      const direction = common.DIRECTONS_KEYS[e.key];

      if (direction !== undefined) {
        ws.send(
          JSON.stringify({
            kind: common.MessageKind.PlayerStartMoving,
            id,
            start: true,
            direction,
          }),
        );
      }
    });

    document.addEventListener("keyup", (e: KeyboardEvent) => {
      const direction = common.DIRECTONS_KEYS[e.key];

      if (direction !== undefined) {
        ws.send(
          JSON.stringify({
            kind: common.MessageKind.PlayerStartMoving,
            id,
            start: false,
            direction,
          }),
        );
      }
    });

    document.addEventListener("keyup", (e: KeyboardEvent) => { });

    let previousTimestamp = 0;

    const frame = (timestamp: number) => {
      const deltaTime = (timestamp - previousTimestamp) / 1000;
      previousTimestamp = timestamp;

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = "red";

      joinedPlayers.forEach((player) => {
        common.updatePlayer(player, deltaTime);

        ctx.fillRect(
          player.x,
          player.y,
          common.PLAYER_SIZE,
          common.PLAYER_SIZE,
        );
      });

      window.requestAnimationFrame(frame);
    };

    window.requestAnimationFrame(frame);
  });
})();
