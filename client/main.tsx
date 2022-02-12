// eslint-disable-next-line import/order
import { enableMapSet } from "immer";

enableMapSet();

import { h, render } from "preact";


// eslint-disable-next-line import/no-unassigned-import,  import/no-internal-modules
import "./css/main.css";

import { App } from "./app";

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
if (module.hot) {
  // @ts-ignore
  module.hot.accept();
}
/* eslint-enable @typescript-eslint/ban-ts-comment */


render(<App />, document.body);
