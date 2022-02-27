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
  names: string[];
  order?: string[];
  players: PlayerMap;
  position?: string;
  showProfile: boolean;
  socket: ClientSocket;
}

// eslint-disable-next-line max-len
// ordinal adapted from https://stackoverflow.com/questions/13627308/add-st-nd-rd-and-th-ordinal-suffix-to-a-number
function getPosition(order: string[], name: string): string {
  const num = order.indexOf(name) + 1;

  /* eslint-disable @typescript-eslint/no-magic-numbers */
  const j = num % 10, k = num % 100;
  if (j === 1 && k !== 11) {
    return `${num}st`;
  } else if (j === 2 && k !== 12) {
    return `${num}nd`;
  } else if (j === 3 && k !== 13) {
    return `${num}rd`;
  }
  return `${num}th`;
  /* eslint-enable @typescript-eslint/no-magic-numbers */
}

export class App extends Component<{}, AppState> {
  public constructor(props: {}) {
    super(props);

    const socket = io() as ClientSocket;

    const cookies = parse(document.cookie);

    this.state = {
      admin: false, loading: cookies.name || cookies.password, name: cookies.name, names: [],
      players: new Map(), showProfile: true, socket
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

        draft.order = order;
        draft.players.set(name, rest);

        if (state.name) {
          draft.position = getPosition(order, state.name);
        }
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

        if (state.name) {
          if (draft.order) {
            draft.position = getPosition(draft.order, state.name);
          } else {
            draft.position = undefined;
          }
        }
      }));
    });

    socket.on("names", names => this.setState({ names }));

    socket.on("roll", order => {
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

        if (state.name) {
          draft.position = getPosition(draft.order, state.name);
        }
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

        if (state.name) {
          draft.position = getPosition(order, state.name);
        }
      }));
    });

    socket.on("disconnect", () => {
      this.setState({ admin: false, name: undefined });
    });

    this.handleAuth     = this.handleAuth.bind(this);
    this.handleLogout   = this.handleLogout.bind(this);
    this.handleRefresh  = this.handleRefresh.bind(this);
    this.handleToggle   = this.handleToggle.bind(this);
  }

  public render(): h.JSX.Element {
    return <Fragment>
      {!this.state.name && !this.state.admin && !this.state.loading &&
        <LoginPage
          names={this.state.names} socket={this.state.socket} handleAuth={this.handleAuth}/>}
      {this.state.name && <Profile
        handleLogout={this.handleLogout} name={this.state.name}
        order={this.state.position} refresh={this.handleRefresh}
        socket={this.state.socket} toggleProfile={this.handleToggle}
        visible={this.state.showProfile}
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
      this.setState({
        name: charName, loading: false, order, players, position: getPosition(order, charName)
      });
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

  private handleRefresh(): void {
    if (this.state.name || this.state.admin) {
      this.state.socket.emit("refresh", (error, characters, order) => {
        if (error) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          message.error(`Could not refresh: ${error}`);
        } else {
          this.handleAuth(characters!, order!, this.state.name);
        }
      });
    }
  }

  private handleToggle(): void {
    this.setState(state => ({ showProfile: !state.showProfile }));
  }
}
