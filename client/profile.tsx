import {
  CheckOutlined, CloseOutlined, EditOutlined, LogoutOutlined,
  MinusOutlined, PlusOutlined, SyncOutlined, UserOutlined
} from "@ant-design/icons";
import { Button, Card, Col, Input, InputNumber, message, PageHeader, Row } from "antd";
import { Fragment, h } from "preact";
// eslint-disable-next-line import/no-internal-modules
import { PureComponent } from "preact/compat";

import type { ClientSocket } from "../server/socket";

import type { PlayerProfile } from "./app";

export interface ProfileProps extends PlayerProfile {
  order?: string;
  socket: ClientSocket;
  visible: boolean;

  handleLogout: () => void;
  refresh: () => void;
  toggleProfile: () => void;
}

interface Changes {
  dex?: number;
  wis?: number;
}

export interface ProfileState {
  changes?: Changes;
  name?: string;
}

export class Profile extends PureComponent<ProfileProps, ProfileState> {
  public constructor(props: ProfileProps) {
    super(props);

    this.state = {  };

    this.handleNewName = this.handleNewName.bind(this);
    this.saveEdit = this.saveEdit.bind(this);
    this.startEdit = this.startEdit.bind(this);
    this.startNameChange = this.startNameChange.bind(this);
    this.stopEdit = this.stopEdit.bind(this);
  }

  public render(): h.JSX.Element {
    let actions: h.JSX.Element[];

    if (this.state.changes || this.state.name !== undefined) {
      actions = [
        <Button icon={<CheckOutlined />} key="save"
          onClick={this.state.changes ? this.saveEdit: this.handleNewName} className="statButton"
        >
          Save your changes
        </Button>,
        <Button icon={<CloseOutlined />} key="cancel" onClick={this.stopEdit} danger
          className="statButton"
        >
          Cancel your changes
        </Button>
      ];
    } else {
      actions = [
        <Button icon={<EditOutlined />} key="edit" onClick={this.startEdit}
          className="statButton" type="primary"
        >
        Edit your stats
        </Button>,
        <Button icon={<UserOutlined />} key="name" onClick={this.startNameChange}
          className="statButton"
        >
        Change your name
        </Button>
      ];
    }

    return <Fragment>
      <PageHeader className="top"
        title={<h3 className="header">Stats for {this.props.name}</h3>}
        extra={
          <Fragment>
            <Button type="primary" onClick={this.props.handleLogout} icon={<LogoutOutlined/>}>
            Log out
            </Button>
            <Button type="primary" onClick={this.props.refresh} icon={<SyncOutlined/>}>
            Refresh
            </Button>
            <Button type="primary" onClick={this.props.toggleProfile}
              icon={this.props.visible ? <MinusOutlined /> :<PlusOutlined/>}
            >
              {this.props.visible ? "Hide": "Show"} profile
            </Button>
          </Fragment>
        }
      >
      </PageHeader>
      <Card actions={actions} hidden={!this.props.visible}>
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
              <div className="statContent">Roll: </div>
            </Col>
            <Col flex={1}>
              <div className="statContent">{this.props.roll}</div>
            </Col>
          </Row></Col>}
          {this.props.order && <Col flex={1} className="stat"><Row>
            <Col flex={1}>
              <div className="statContent">Position: </div>
            </Col>
            <Col flex={1}>
              <div className="statContent">{this.props.order}</div>
            </Col>
          </Row></Col>}
        </Row>
        {this.state.name !== undefined && <Row>
          <Input addonBefore="New character name!" className="nameEdit"
            onChange={(e): void => this.setState({ name: e.target.value })} />
        </Row>}
      </Card>
    </Fragment>;
  }

  private handleChange(field: keyof Changes): (value: number | null) => void {
    return (value: number | null): void => {
      this.setState(state => ({
        changes: {
          ...state.changes,
          [field]: value ?? undefined
        }
      }));
    };
  }

  private handleNewName(): void {
    this.props.socket.emit("update", this.props.name, { name: this.state.name! }, error => {
      if (error) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.error(`Could not change your name: ${error}`);
      } else {
        this.setState({ name: undefined });
      }
    });
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

  private startNameChange(): void {
    this.setState({ name: "" });
  }

  private stopEdit(): void {
    this.setState({ changes: undefined, name: undefined });
  }
}
