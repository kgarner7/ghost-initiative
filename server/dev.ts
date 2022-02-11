import webpack, { Configuration } from "webpack";
import middleware from "webpack-dev-middleware";
import reload from "webpack-hot-middleware";

import config from "../webpack.dev.config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupDevServer(app: any): void {
  const compiler = webpack({...config as Configuration});
  const webpackMiddleware = middleware(compiler, {
    writeToDisk: file => file.endsWith(".html")
  });

  app.use(webpackMiddleware);
  app.use(reload(compiler));
}
