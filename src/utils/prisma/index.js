import { PrismaClient as GameDataClient } from "../../../prisma/game/generated/gameDataClient/index.js";
import { PrismaClient as UserDataClient } from "../../../prisma/user/generated/userDataClient/index.js";

export const gameDataClient = new GameDataClient({
    log: ["query", "info", "warn", "error"],
    errorFormat: "pretty",
});

export const userDataClient = new UserDataClient({
    log: ["query", "info", "warn", "error"],
    errorFormat: "pretty",
});