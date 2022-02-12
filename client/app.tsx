import { message } from "antd";
import { parse, serialize } from "cookie";
import produce from "immer";
import { h, Component, Fragment } from "preact";
import io from "socket.io-client";

import type { ClientSocket, SocketCharacter } from "../server/socket";

import { Admin } from "./admin";
import { COOKIE_LIFETIME, LoginPage } from "./login";
import { Profile } from "./profile";
import { Tracker } from "./tracker";

export interface PlayerProfile {
  dex: number;
  initiative: number | null;
  name: string;
  roll: number | null;
  wis: number;
}


// eslint-disable-next-line @typescript-eslint/no-type-alias
export type PlayerMap = Map<string, Omit<SocketCharacter, "name">>;

interface AppState {
  admin: boolean;
  loading: boolean;
  name?: string;
  order?: string[];
  players: PlayerMap;
  socket: ClientSocket;
}

export class App extends Component<{}, AppState> {
  public constructor(props: {}) {
    super(props);


    const socket = io() as ClientSocket;

    const cookies = parse(document.cookie);

    this.state = {
      admin: false, loading: cookies.name || cookies.password, players: new Map(), socket
    };

    socket.on("connect", () => {
      if (cookies.name) {
        socket.emit("authenticate", cookies.name, undefined, (error, characters, order) => {

          if (error) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            message.error(`An error occurred when trying to authenticate: ${error}`);
            this.setState({ loading: false });
          } else {
            this.handleAuth(characters!, order!, cookies.name);
          }
        });
      } else if (cookies.password) {
        socket.emit("authenticate", undefined, cookies.password, (error, characters, order) => {
          if (error) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            message.error(`An error occurred when trying to authenticate: ${error}`);
          } else {
            this.handleAuth(characters!, order!);
          }
        });
      }
    });

    socket.on("create", (character, order) => {
      this.setState(state => produce(state, draft => {
        const { name, ...rest } = character;

        draft.players.set(name, rest);
        draft.order = order;
      }));
    });

    socket.on("hide", name => {
      this.setState(state => produce(state, draft => {
        if (name === this.state.name) {
          document.cookie = serialize("name", "", {
            expires: new Date(0), maxAge: 0, sameSite: "strict"
          });

          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          message.error("Your character was deleted", 10);

          draft.name    = undefined;
          draft.order   = undefined;
          draft.players.clear();
        } else {
          draft.players.delete(name);
          draft.order = draft.order?.filter(char => char !== name);
        }
      }));
    });

    socket.on("roll",  order => {
      this.setState(state => produce(state, draft => {
        draft.order = order.map(char => {
          const player = draft.players.get(char.name);

          if (player) {
            player.initiative = char.initiative;
            player.roll = char.roll;
          } else {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            message.error(`No player ${player}`);
          }

          return char.name;
        });
      }));
    });

    socket.on("update", (oldName, character, order) => {
      this.setState(state => produce(state, draft => {
        if (oldName === this.state.name &&
          character.name !== undefined && character.name !== oldName) {
          draft.name = character.name;

          document.cookie = serialize("name", character.name, {
            maxAge: COOKIE_LIFETIME, sameSite: "strict"
          });
        }

        const player = draft.players.get(oldName);

        if (player) {
          const { name, ...rest } = character;

          if (name !== undefined && name !== oldName) {
            draft.players.delete(oldName);
            oldName = name;
          }

          draft.players.set(oldName , {
            ...player,
            ...rest
          });
        } else {
          draft.players.set(oldName, {
            ...character
          });
        }

        draft.order = order;
      }));
    });

    socket.on("disconnect", () => {
      this.setState({ admin: false, name: undefined });
    });

    this.handleAuth   = this.handleAuth.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
  }

  public render(): h.JSX.Element {
    return <Fragment>
      {!this.state.name && !this.state.admin && !this.state.loading &&
        <LoginPage socket={this.state.socket} handleAuth={this.handleAuth}/>}
      {this.state.name && <Profile
        socket={this.state.socket}
        name={this.state.name}
        handleLogout={this.handleLogout}
        // This type annotation is safe because we are guaranteed to
        // get full information for ourselves
        {...this.state.players.get(this.state.name)! as Omit<PlayerProfile, "name">}
      />}
      {this.state.admin && <Admin handleLogout={this.handleLogout} socket={this.state.socket}/>}
      {this.state.order && <Tracker
        admin={this.state.admin} name={this.state.name} order={this.state.order}
        players={this.state.players} socket={this.state.socket}/>}
    </Fragment>;
  }

  private handleAuth(characters: SocketCharacter[], order: string[], charName?: string): void {
    const players = new Map(characters.map(character => {
      const { name, ...rest } = character;

      return [name, rest];
    }));

    if (charName !== undefined) {
      this.setState({ name: charName, loading: false, order, players });
    } else {
      this.setState({ admin: true, loading: false, order, players });
    }
  }

  private handleLogout(): void {
    this.state.socket.emit("logout", error => {
      if (error) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.error(`An error occurred when trying to log out:\n${error}`);
      }

      const expires = new Date(0);

      for (const cookie of ["name", "password"]) {
        document.cookie = serialize(cookie, "", {
          expires, maxAge: 0, sameSite: "strict"
        });
      }

      this.setState({ admin: undefined, name: undefined, order: undefined, players: new Map() });
    });
  }
}
