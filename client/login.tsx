import { Typography, Form, Input, Checkbox, Button, Tabs } from "antd";
import { serialize } from "cookie";
import { h } from "preact";
import { PureComponent } from "preact/compat";

import type { ClientSocket, SocketCharacter } from "../server/socket";

// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const COOKIE_LIFETIME = 60 * 60 * 24 * 14;  // 2 weeks
const FORM_WRAPPER = { lg: 21, md: 19, sm: 17 };
const FORM_LABEL = { lg: 3, md: 5, sm: 7 };

const WRAPPER_COL = {
  lg: { offset: 3, span: 21},
  md: { offset: 5, span: 19 },
  sm: { offset: 7, span: 17}
};

interface LoginPageProps {
  socket: ClientSocket;

  handleAuth: (characters: SocketCharacter[], order: string[], name?: string) => void;
}

interface FormProps {
  password?: string;
  remember?: boolean;
  username?: string;
}

// eslint-disable-next-line max-len
// From https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript#5158301
function getParameterByName(name: string): string | null {
  name = name.replace(/[\[\]]/g, "\\$&");
  const regex = new RegExp(`[?&]${  name  }(=([^&#]*)|&|#|$)`),
    results = regex.exec(location.search);

  if (!results) return null;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}

const defaults = {
  name: getParameterByName("name"),
  token: getParameterByName("token")
};

export class LoginPage extends PureComponent<LoginPageProps> {
  public constructor(props: LoginPageProps) {
    super(props);

    this.handleSubmit = this.handleSubmit.bind(this);
  }

  public render(): h.JSX.Element {
    return <Tabs centered defaultActiveKey="player">
      <Tabs.TabPane key="player" tab="Player Login">
        <Form
          layout="horizontal" wrapperCol={FORM_WRAPPER} labelCol={FORM_LABEL}
          onFinish={this.handleSubmit}
        >
          <Form.Item
            label="Character name" name="username"
            rules={[{ required: true, message: "Please provide your character name" }]}
            initialValue={defaults.name}
          >
            <Input placeholder="Your character's name (as it currently appears in Discord)"/>
          </Form.Item>

          <Form.Item
            name="remember" valuePropName="checked" wrapperCol={WRAPPER_COL} initialValue={true}
          >
            <Checkbox>Remember me</Checkbox>
          </Form.Item>

          <Form.Item wrapperCol={WRAPPER_COL}>
            <Button type="primary" htmlType="submit" style={{ width: "100%"}}>Log in</Button>
          </Form.Item>
        </Form>
      </Tabs.TabPane>

      <Tabs.TabPane key="gm" tab="GM Login">
        <Form
          layout="horizontal" wrapperCol={FORM_WRAPPER} labelCol={FORM_LABEL}
          onFinish={this.handleSubmit}
        >
          <Form.Item
            label="GM password" name="password"
            rules={[{ required: true, message: "Please provide your GM password" }]}
            initialValue={defaults.token}
          >
            <Input.Password placeholder="Randomly generated string"/>
          </Form.Item>

          <Form.Item
            name="remember" valuePropName="checked" wrapperCol={WRAPPER_COL} initialValue={true}
          >
            <Checkbox>Remember me</Checkbox>
          </Form.Item>

          <Form.Item wrapperCol={WRAPPER_COL}>
            <Button type="primary" htmlType="submit"  style={{ width: "100%"}}>Log in</Button>
          </Form.Item>
        </Form>
      </Tabs.TabPane>
    </Tabs>;
  }

  private handleSubmit(values: FormProps): void {
    this.props.socket.emit("authenticate", values.username, values.password,
      (error, chars, order) => {
        if (error) {
          alert(error);
        } else {
          if (values.remember) {
            if (values.username) {
              document.cookie = serialize("name", values.username, {
                maxAge: COOKIE_LIFETIME, sameSite: "strict"
              });
            } else if (values.password) {
              document.cookie = serialize("password", values.password, {
                maxAge: COOKIE_LIFETIME, sameSite: "strict"
              });
            }
          }

          this.props.handleAuth(chars!, order!, values.username);
        }
      });
  }
}

export default LoginPage;
