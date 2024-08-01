import type { ServerWebSocket } from "bun";

export const PORT = 3333;
export const GAME_WIDTH = 1000;
export const GAME_HEIGHT = 800;
export const PLAYER_SIZE = 20;
export const PLAYER_SPEED = 400;

export interface SocketData {
  id: number;
}

export interface Player {
  id: number;
  x: number;
  y: number;
  moving: Moving;
  hue: number;
}

export enum MessageKind {
  Welcome,
  PlayerJoined,
  PlayerLeft,
  PlayerMoving,
  PlayerStartMoving,
}

export type Direction = "left" | "right" | "up" | "down";

type Moving = {
  [key in Direction]: boolean;
};

export function isMoving(arg: any): arg is Moving {
  return (
    arg &&
    isBoolean(arg.left) &&
    isBoolean(arg.right) &&
    isBoolean(arg.up) &&
    isBoolean(arg.down)
  );
}

export type Vector = { x: number; y: number };

export const DIRECTION_VECTORS: { [key in Direction]: Vector } = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

export function isDirection(arg: any): arg is Direction {
  return DIRECTION_VECTORS[arg as Direction] !== undefined;
}

export const DIRECTONS_KEYS: { [key: string]: Direction } = {
  ArrowUp: "up",
  w: "up",
  k: "up",
  ArrowDown: "down",
  s: "down",
  j: "down",
  ArrowLeft: "left",
  a: "left",
  h: "left",
  ArrowRight: "right",
  d: "right",
  l: "right",
};

const UINT8_SIZE = 1;
const UINT32_SIZE = 4;
const FLOAT32_SIZE = 4;

interface Field {
  offset: number;
  size: number;
  read: (view: DataView, baseOffset: number) => number;
  write: (view: DataView, baseOffset: number, value: number) => void;
}

function allocUint8Field(alloc: { iota: number }): Field {
  const offset = alloc.iota;

  alloc.iota += UINT8_SIZE;

  return {
    offset,
    size: UINT8_SIZE,
    read: (view, baseOffset) => view.getUint8(baseOffset + offset),
    write: (view, baseOffset, value) =>
      view.setUint8(baseOffset + offset, value),
  };
}

function allocUint32Field(alloc: { iota: number }): Field {
  const offset = alloc.iota;

  alloc.iota += UINT32_SIZE;

  return {
    offset,
    size: UINT32_SIZE,
    read: (view, baseOffset) => view.getUint32(baseOffset + offset, true),
    write: (view, baseOffset, value) =>
      view.setUint32(baseOffset + offset, value, true),
  };
}

function allocFloat32Field(alloc: { iota: number }): Field {
  const offset = alloc.iota;

  alloc.iota += FLOAT32_SIZE;

  return {
    offset,
    size: FLOAT32_SIZE,
    read: (view, baseOffset) => view.getFloat32(baseOffset + offset, true),
    write: (view, baseOffset, value) =>
      view.setFloat32(baseOffset + offset, value, true),
  };
}

export const WelcomeStruct = (() => {
  const alloc = { iota: 0 };

  return {
    kind: allocUint8Field(alloc),
    id: allocUint32Field(alloc),
    x: allocFloat32Field(alloc),
    y: allocFloat32Field(alloc),
    hue: allocUint8Field(alloc),
    size: alloc.iota,
  };
})();

export interface Welcome {
  kind: MessageKind.Welcome;
  id: number;
  x: number;
  y: number;
  hue: number;
}

export function isWelcome(arg: any): arg is Welcome {
  return (
    arg &&
    arg.kind === MessageKind.Welcome &&
    isNumber(arg.id) &&
    isNumber(arg.x) &&
    isNumber(arg.y) &&
    isNumber(arg.hue)
  );
}

export interface PlayerJoined {
  kind: MessageKind.PlayerJoined;
  id: number;
  x: number;
  y: number;
  moving: Moving;
  hue: number;
}

export function isPlayerJoined(arg: any): arg is PlayerJoined {
  return (
    arg &&
    arg.kind === MessageKind.PlayerJoined &&
    isNumber(arg.id) &&
    isNumber(arg.x) &&
    isNumber(arg.y) &&
    isMoving(arg.moving) &&
    isNumber(arg.hue)
  );
}

export interface PlayerLeft {
  kind: MessageKind.PlayerLeft;
  id: number;
}

export function isPlayerLeft(arg: any): arg is PlayerLeft {
  return arg && arg.kind === MessageKind.PlayerLeft && isNumber(arg.id);
}

export interface PlayerMoving {
  kind: MessageKind.PlayerMoving;
  id: number;
  x: number;
  y: number;
  start: boolean;
  direction: Direction;
}

export function isPlayerMoving(arg: any): arg is PlayerMoving {
  return (
    arg &&
    arg.kind === MessageKind.PlayerMoving &&
    isNumber(arg.id) &&
    isNumber(arg.x) &&
    isNumber(arg.y) &&
    isBoolean(arg.start) &&
    isDirection(arg.direction)
  );
}

export interface PlayerStartMoving {
  kind: MessageKind.PlayerStartMoving;
  start: boolean;
  direction: Direction;
}

export function isPlayerStartMoving(arg: any): arg is PlayerStartMoving {
  return (
    arg &&
    arg.kind === MessageKind.PlayerStartMoving &&
    isBoolean(arg.start) &&
    isDirection(arg.direction)
  );
}

function isNumber(arg: any): arg is number {
  return typeof arg === "number";
}

function isBoolean(arg: any): arg is boolean {
  return typeof arg === "boolean";
}

function modulo(a: number, b: number): number {
  return ((a % b) + b) % b;
}

export function updatePlayer(player: Player, deltaTime: number) {
  let dir: Direction;
  let dx = 0,
    dy = 0;

  for (dir in DIRECTION_VECTORS) {
    if (player.moving[dir]) {
      dx += DIRECTION_VECTORS[dir].x;
      dy += DIRECTION_VECTORS[dir].y;
    }
  }

  player.x = modulo(player.x + dx * PLAYER_SPEED * deltaTime, GAME_WIDTH);
  player.y = modulo(player.y + dy * PLAYER_SPEED * deltaTime, GAME_HEIGHT);
}

export function sendMessage<T>(
  ws: WebSocket | ServerWebSocket<SocketData>,
  message: T,
): number {
  const data = JSON.stringify(message);

  ws.send(JSON.stringify(message));

  return data.length;
}
