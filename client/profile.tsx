import {
  CheckOutlined, CloseOutlined, EditOutlined
} from "@ant-design/icons";
import { Button, Card, Col, InputNumber, message, Row } from "antd";
import { Fragment, h } from "preact";
// eslint-disable-next-line import/no-internal-modules
import { PureComponent } from "preact/compat";

import type { ClientSocket } from "../server/socket";

import type { PlayerProfile } from "./app";

export interface ProfileProps extends PlayerProfile {
  socket: ClientSocket;
  handleLogout: () => void;
}

interface Changes {
  dex?: number;
  wis?: number;
}

export interface ProfileState {
  changes?: Changes;
}

export class Profile extends PureComponent<ProfileProps, ProfileState> {
  public constructor(props: ProfileProps) {
    super(props);

    this.state = {};

    this.saveEdit = this.saveEdit.bind(this);
    this.startEdit = this.startEdit.bind(this);
    this.stopEdit = this.stopEdit.bind(this);
  }

  public render(): h.JSX.Element {
    const actions = this.state.changes ? [
      <Button icon={<CheckOutlined />} key="cancel" onClick={this.saveEdit}
        className="statButton"
      >
        Save your changes
      </Button>,
      <Button icon={<CloseOutlined />} key="cancel" onClick={this.stopEdit} danger
        className="statButton"
      >
        Cancel your changes
      </Button>
    ]: [
      <Button icon={<EditOutlined />} key="edit" onClick={this.startEdit}
        className="statButton"
      >
        Edit your stats
      </Button>
    ];

    return <Card title={<h2 className="header">
      Stats for {this.props.name}!
    </h2>} actions={actions} extra={
      <Button type="primary" onClick={this.props.handleLogout}>Log out</Button>
    }>
      <Row>
        <Col flex={1} className="stat"><Row>
          <Col flex={1}>
            <div className="statContent">Dexterity: </div>
          </Col>
          <Col flex={1}>
            { this.state.changes ?
              <InputNumber
                className="statContent" defaultValue={this.props.dex} min={1} max={5}
                onChange={this.handleChange("dex")} />:
              <div className="statContent">{this.props.dex}</div>
            }
          </Col>
        </Row></Col>
        <Col flex={1} className="stat"><Row>
          <Col flex={1}>
            <div className="statContent">Wits: </div>
          </Col>
          <Col flex={1}>
            { this.state.changes ?
              <InputNumber
                className="statContent" defaultValue={this.props.wis} min={1} max={5}
                onChange={this.handleChange("wis")} />:
              <div className="statContent">{this.props.wis}</div>
            }
          </Col>
        </Row></Col>
        {this.props.roll && <Col flex={1} className="stat"><Row>
          <Col flex={1}>
            <div className="statContent">Initiative Roll: </div>
          </Col>
          <Col flex={1}>
            <div className="statContent">{this.props.roll}</div>
          </Col>
        </Row></Col>}
      </Row>
    </Card>;
  }

  private handleChange(field: keyof Changes): (value: number) => void {
    return (value: number): void => {
      this.setState(state => ({
        changes: {
          ...state.changes,
          [field]: value
        }
      }));
    };
  }

  private saveEdit(): void {
    const dex = this.state.changes?.dex ?? this.props.dex;
    const wis = this.state.changes?.wis ?? this.props.wis;

    const errors: string[] = [];

    if (dex < 1 || dex > 5) {
      errors.push("Dexterity must be between 1 and 5 (inclusive)");
    }

    if (wis < 1 || wis > 5) {
      errors.push("Wits must be between 1 and 5 (inclusive)");
    }

    if (errors.length > 0) {
      for (const error of errors) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.error(error);
      }
    } else {
      this.props.socket.emit("update", this.props.name, { dex, wis }, error => {
        if (error) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          message.error(error);
        } else {
          this.setState({ changes: undefined });
        }
      });
    }
  }

  private startEdit(): void {
    this.setState({ changes: {} });
  }

  private stopEdit(): void {
    this.setState({ changes: undefined });
  }
}