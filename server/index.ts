import { Server } from "http";

import compression from "compression";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express, { Response } from "express";

import { client } from "./database";
import { socketListen } from "./socket";

dotenv.config();

const app = express();
app.set("trust proxy", "loopback");

app.disable("x-powered-by");
app.use(compression());

app.use(cookieParser());

// compress data
app.use(compression());

const staticOps = {
  maxAge: "30d",
  setHeaders: (res: Response): void => {
    res.removeHeader("X-Powered-By");
    res.setHeader("server", "");
  }
};

// serve static files
app.use(express.static("out/frontend", staticOps));
app.use(express.static("client/static", staticOps));

export const server = new Server(app);

socketListen(server);

if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line max-len
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { setupDevServer } = require("./dev");
  setupDevServer(app);
}


client.$connect().then(() => {
  server.listen(process.env.PORT, () => {
    console.log("Listening on port %d", process.env.PORT);
  });
})
  .catch(error => {
    console.error(error);
    process.exit(-1);
  });

