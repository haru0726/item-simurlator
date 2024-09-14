import express from "express";
import cookieParser from "cookie-parser";
import UsersRouter from "./routes/users.router.js";
import GameRouter from "./routes/game.router.js";
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use("/api", [UsersRouter, GameRouter]);

app.listen(PORT, () => {
  console.log(`${PORT} 포트로 서버가 열렸어요!`);
});
