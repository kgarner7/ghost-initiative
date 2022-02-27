import { randomInt } from "crypto";
import { Server as HTTPServer } from "http";

import { Character, Prisma, PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import type { Socket } from "socket.io-client";

import { client } from "./database";


const GM_ROOM = "gm";
const PLAYER_ROOM = "player";

// eslint-disable-next-line @typescript-eslint/no-type-alias
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type ErrorCallback = (error?: string) => void;

export interface SocketCharacter {
  dex?: number;
  hidden?: boolean;
  initiative: number | null;
  name: string;
  player: boolean;
  roll?: number | null;
  wis?: number;
}

export interface CharacterCreate {
  dex: number;
  hidden: boolean;
  name: string;
  roll: number | null;
  wis: number;
}

// eslint-disable-next-line @typescript-eslint/no-type-alias
export interface CharacterUpdate {
  dex?: number;
  name?: string;
  hidden?: boolean;
  roll?: number;
  wis?: number;
}

export interface CharacterUpdateResult {
  dex?: number;
  hidden?: boolean;
  name?: string;
  initiative: number | null;
  player: boolean;
  roll?: number | null;
  wis?: number;
}

interface CharacterRoll {
  initiative: number;
  name: string;
  roll?: number;
}

export interface ClientToServer {
  authenticate: (
    name: string | undefined,
    token: string | undefined,
    cb: (error: string | undefined, characters?: SocketCharacter[], order?: string[]) => void
  ) => Promise<void>;
  create: (character: CharacterCreate, cb: ErrorCallback) => void;
  delete: (name: string, cb: ErrorCallback) => void;
  refresh: (
    cb: (error: string | undefined, characters?: SocketCharacter[], order?: string[]) => void
  ) => Promise<void>;
  logout: (cb: ErrorCallback) => void;
  roll: (cb: ErrorCallback) => void;
  update: (name: string, data: CharacterUpdate, cb: ErrorCallback) => Promise<void>;
}

export interface ServerToClient {
  create: (character: SocketCharacter, order: string[]) => void;
  hide: (name: string) => void;
  names: (names: string[]) => void;
  roll: (order: CharacterRoll[]) => void;
  update: (name: string, character: CharacterUpdateResult, order: string[]) => void;
}

interface SocketData {
  admin?: boolean;
  name?: string;
}

// eslint-disable-next-line @typescript-eslint/no-type-alias
export type ClientSocket = Socket<ServerToClient, ClientToServer>;

function orderCharacters(characters: Array<PartialBy<Character, "hidden">>, admin: boolean):
[SocketCharacter[], string[]] {
  const order: string[] = [];

  const result: SocketCharacter[] = characters.sort((a, b) => {
    if (a.roll === null && b.roll === null) {
      return a.name.localeCompare(b.name);
    } else if (a.roll === null) {
      return 1;
    } else if (b.roll === null) {
      return -1;
    }

    const rollDiff = b.roll - a.roll;
    const statDiff = (b.dex + b.wis) - (a.dex + a.wis);

    const initiativeDiff = rollDiff + statDiff;

    if (initiativeDiff !== 0) {
      return initiativeDiff;
    } else {
      if (rollDiff !== 0) {
        return rollDiff;
      } else {
        if (b.tiebreak !== null && a.tiebreak !== null) {
          return b.tiebreak - a.tiebreak;
        } else {
          return a.name.localeCompare(b.name);
        }
      }
    }
  })
    .map(character => {
      order.push(character.name);

      const initiative = character.roll !== null ?
        character.wis + character.dex + character.roll: null;

      if (character.player || admin) {
        return { ...character, initiative };
      } else {
        return { initiative, name: character.name, player: false };
      }
    });

  return [result, order];
}

// WARNING: This function calls randomInt synchronously. Don't do this in practice
function shuffleArray<T>(arr: T[]): T[] {
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  return arr.sort(() => 0.5 - randomInt(0, 2));
}

// eslint-disable-next-line @typescript-eslint/no-type-alias
type Transaction = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use">;

async function updateAllStats<T>(extra: (transaction: Transaction) => Promise<T>):
Promise<[T, Character[], Character[]]> {
  const [funResunt, newOrder] = await client.$transaction(async transaction => {
    const result = await extra(transaction);

    const characters = await transaction.character.findMany();

    const charMap: Map<null | string, Character[]> = new Map();

    let anyRolls = false;

    for (const char of characters) {
      const key: null | string = char.roll === null ?
        null: `${char.roll + char.dex + char.wis}-${char.roll}`;

      const entry = charMap.get(key);

      if (entry) {
        entry.push(char);
      } else {
        charMap.set(key, [char]);
      }

      anyRolls ||= key !== null;
    }

    if (!anyRolls) {
      const order = characters.sort((a, b) => a.name
        .localeCompare(b.name));

      return [result, order];
    } else {
      const resolutions: Array<[number, Character]> = [];

      const order: Character[] = [];

      const arrayEntries = Array.from(charMap.entries())
        .sort((a, b) => {
          if (a[0] === null) {
            return 1;
          } else if (b[0] === null) {
            return -1;
          }

          const [overallA, rollA] = a[0].split("-").map(int => parseInt(int, 10));
          const [overallB, rollB] = b[0].split("-").map(int => parseInt(int, 10));

          if (overallA !== overallB) {
            return overallB - overallA;
          } else {
            return rollB - rollA;
          }
        });

      for (const [, names] of arrayEntries) {
        if (names.length === 1) {
          order.push(names[0]);
        } else {
          const sorted = shuffleArray(names);

          resolutions.push(...Array.from(sorted.entries()));
          order.push(...sorted.reverse());
        }
      }

      for (const [tiebreak, character] of resolutions) {
        await transaction.character.updateMany({
          data: { tiebreak },
          where: { name: character.name }
        });
      }

      return [result, order];
    }
  });


  const fullOrder: Character[] = [];
  const visibleOrder: Character[] = [];

  for (const character of newOrder) {
    fullOrder.push(character);

    if (!character.hidden) {
      visibleOrder.push(character);
    }
  }

  return [funResunt, fullOrder, visibleOrder];
}

export function socketListen(app: HTTPServer): Server {
  const io = new Server<ClientToServer, ServerToClient, {}, SocketData>(app);

  io.on("connection", async socket => {
    {
      const characters = await client.character.findMany({
        select: { name: true },
        orderBy: { name: "asc" },
        where: {
          player: true
        }
      });

      socket.emit("names", characters.map(char => char.name));
    }

    socket.on("authenticate", async (name, token, cb) => {
      const nameIsString = typeof name === "string";
      const tokenIsString = typeof token === "string";

      if (!nameIsString && !tokenIsString) {
        cb("You must provide either a name or GM password");
        return;
      } else if (nameIsString && tokenIsString) {
        cb("You must provide ONLY a name or GM password");
        return;
      }

      if (name) {
        const [create, characters] = await client.$transaction([
          client.character.createMany({
            data: [{ name, hidden: false, player: true }],
            skipDuplicates: true
          }),
          client.character.findMany({
            select: {
              dex: true, name: true, player: true, roll: true, tiebreak: true, wis: true
            },
            where: { hidden: false }
          })
        ]);


        await socket.join(PLAYER_ROOM);

        const [result, order] = orderCharacters(characters, false);
        cb(undefined, result, order);

        if (create.count > 0) {
          socket.broadcast.emit("create", {
            name, initiative: null, player: true
          }, order);
        }

        socket.data = { admin: false, name };

      } else {
        if (token !== process.env.GM_TOKEN) {
          cb("Invalid password");
          return;
        }

        const characters = await client.character.findMany();
        const [result, order] = orderCharacters(characters, true);

        socket.data = { admin: true };
        await socket.join(GM_ROOM);

        cb(undefined, result, order);
      }
    });

    socket.on("create", async (char, cb) => {
      if (!socket.data.admin) {
        cb("You must be a GM to force a reroll");
        return;
      }

      // be very careful when accepting user input
      const { dex, hidden, name, roll, wis } = char;

      if (typeof dex !== "number" || dex < 1 || dex > 5) {
        cb("Dexterity must be between 1 and 5 (inclusive)");
        return;
      } else if (typeof wis !== "number" || wis < 1 || wis > 5) {
        cb("Wits must be between 1 and 5 (inclusive)");
        return;
      } else if (roll !== null && (typeof roll !== "number" || roll < 1 || roll > 10)) {
        cb("Initiative roll must be between 1 and 10 (inclusive)");
        return;
      } else if (typeof name !== "string") {
        cb("Character name must be a string");
        return;
      } else if (hidden !== null && typeof hidden !== "boolean") {
        cb("Hidden must be a boolean (or null)");
        return;
      }

      const [initiative, fullOrder, visibleOrder] = await updateAllStats(async transaction => {
        await transaction.character.createMany({ data: {
          dex, hidden, name, player: false, roll, wis
        }});

        return roll === null ? null: dex + wis + roll;
      });

      io.to(GM_ROOM).emit("create", {
        dex, hidden, initiative, name, player: false, roll, wis
      }, fullOrder.map(character => character.name));

      if (!hidden) {
        io.to(PLAYER_ROOM).emit("create", {
          initiative, name, player: false
        }, visibleOrder.map(character => character.name));
      }

      cb();
    });

    socket.on("delete", async (name, cb) => {
      if (!socket.data.admin) {
        cb("You must be a GM to delete a character");
        return;
      }

      const deleted = await client.character.deleteMany({
        where: { name }
      });

      if (deleted.count === 0) {
        cb(`No character ${name} found`);
      } else {
        cb();
        io.emit("hide", name);
      }
    });

    socket.on("refresh", async cb => {
      try {
        if (!socket.data.admin && !socket.data.name) {
          cb("You must be logged in as a player or GM");
          return;
        }

        if (!socket.data.admin) {
          const characters = await client.character.findMany({
            select: {
              dex: true, name: true, player: true, roll: true, tiebreak: true, wis: true
            },
            where: { hidden: false }
          });

          const [result, order] = orderCharacters(characters, false);
          cb(undefined, result, order);

        } else {
          const characters = await client.character.findMany();
          const [result, order] = orderCharacters(characters, true);

          cb(undefined, result, order);
        }
      } catch (error) {
        cb((error as Error).message);
      }
    });

    socket.on("roll", async cb => {
      if (!socket.data.admin) {
        cb("You must be a GM to force a reroll");
        return;
      }

      const [, fullOrder, visibleOrder] = await updateAllStats(async transaction =>
        transaction.$executeRaw`UPDATE "Character" SET roll = floor(random() * 10) + 1;`);

      io.to(GM_ROOM).emit("roll", fullOrder.map(char => ({
        initiative: char.dex + char.wis + char.roll!, name: char.name, roll: char.roll!
      })));

      io.to(PLAYER_ROOM).emit("roll", visibleOrder.map(char => {
        const initiative = char.dex + char.wis + char.roll!;

        if (char.player) {
          return { name: char.name, roll: char.roll!, initiative };
        } else {
          return { name: char.name, initiative };
        }
      }));
    });

    // eslint-disable-next-line complexity
    socket.on("update", async (oldName, data, cb) => {
      const { dex, name, hidden, roll, wis } = data;

      try {
        if (!socket.data.admin) {
          if (hidden !== undefined || roll !== undefined || oldName !== socket.data.name) {
            cb("You must be a GM to change these permissions");
            return;
          }
        } else {
          if (hidden !== undefined && typeof hidden !== "boolean") {
            cb("Hidden must be a boolean");
            return;
          } else if (roll !== undefined && roll !== null &&
            (typeof roll !== "number" || roll < 1 || roll > 10)) {
            cb("Initiative roll must be between 1 and 10 (inclusive)");
          }
        }

        if (typeof oldName !== "string") {
          cb("Name must be a string");
          return;
        } else if (name !== undefined && typeof name !== "string") {
          cb("updated name must be a string");
          return;
        }

        const updateData: Prisma.CharacterUpdateManyMutationInput = {};

        if (dex !== undefined) {
          if (typeof dex !== "number" || dex < 1 || dex > 5) {
            cb("Dexterity must be between 1 and 5 (inclusive)");
            return;
          } else {
            updateData.dex = dex;
          }
        }

        if (wis !== undefined) {
          if (typeof wis !== "number" || wis < 1 || wis > 5) {
            cb("Wits must be between 1 and 5 (inclusive)");
            return;
          } else {
            updateData.wis = wis;
          }
        }

        if (hidden !== undefined) {
          updateData.hidden = hidden;
        }

        if (name) {
          updateData.name = name;
        }

        if (roll !== undefined) {
          updateData.roll = roll;
        }

        const [
          [hiddenOriginally, originalRoll, isPlayer, originalDex, originalwits],
          fullOrder, visibleOrder
        ] = await updateAllStats(
          async transaction => {
            const original = await transaction.character.findUnique({
              where: { name: oldName }
            });

            if (!original) {
              throw new Error(`No character ${oldName} found`);
            } else if (original.player && updateData.name !== undefined &&
              oldName !== socket.data.name) {
              throw new Error("Only a player may rename themselves");
            }

            await transaction.character.updateMany({
              data: updateData, where: { name: oldName }
            });

            return [original.hidden, original.roll, original.player, original.dex, original.wis];
          });

        const newHidden = hidden ?? hiddenOriginally;
        const newRoll   = roll === undefined ? originalRoll : roll;

        const initiative = newRoll !== null ?
          (dex ?? originalDex) + newRoll + (wis ?? originalwits): null;

        io.to(GM_ROOM).emit("update", oldName, {
          dex, hidden, initiative, name, player: isPlayer, roll: newRoll, wis
        },fullOrder.map(char => char.name));

        if (!newHidden) {
          const result: CharacterUpdateResult = {
            initiative, name, player: isPlayer
          };

          if (isPlayer) {
            result.dex  = dex;
            result.roll = newRoll;
            result.wis  = wis;
          }

          io.to(PLAYER_ROOM).emit("update", oldName, result, visibleOrder.map(char => char.name));
        } else if (hiddenOriginally === false) {
          io.to(PLAYER_ROOM).emit("hide", oldName);
        }

        if (isPlayer && socket.data.name === oldName && name !== undefined && name !== oldName) {
          socket.data.name = name;
        }

        cb();
      } catch (error) {
        cb((error as Error).message);
      }
    });

    socket.on("logout", cb => {
      try {
        socket.data = {};
        cb();
      } catch (error) {
        cb((error as Error).message);
      }
    });
  });

  return io;
}
