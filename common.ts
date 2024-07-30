export const PORT = 3333;
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const PLAYER_SIZE = 30;
export const PLAYER_SPEED = 500;

export interface Player {
  id: number;
  x: number;
  y: number;
  moving: Moving;
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

export const DIRECTONS_KEYS: { [key: string]: string } = {
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

export interface Welcome {
  kind: MessageKind.Welcome;
  id: number;
}

export function isWelcome(arg: any): arg is Welcome {
  return arg && arg.kind === MessageKind.Welcome && isNumber(arg.id);
}

export interface PlayerJoined {
  kind: MessageKind.PlayerJoined;
  id: number;
  x: number;
  y: number;
}

export function isPlayerJoined(arg: any): arg is PlayerJoined {
  return (
    arg &&
    arg.kind === MessageKind.PlayerJoined &&
    isNumber(arg.id) &&
    isNumber(arg.x) &&
    isNumber(arg.y)
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
  id: number;
  start: boolean;
  direction: Direction;
}

export function isPlayerStartMoving(arg: any): arg is PlayerStartMoving {
  return (
    arg &&
    arg.kind === MessageKind.PlayerStartMoving &&
    isNumber(arg.id) &&
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

  // const l = dx * dx + dy * dy;
  // if (l !== 0) {
  //   dx /= l;
  //   dy /= l;
  // }

  player.x = modulo(player.x + dx * PLAYER_SPEED * deltaTime, GAME_WIDTH);
  player.y = modulo(player.y + dy * PLAYER_SPEED * deltaTime, GAME_HEIGHT);
}
