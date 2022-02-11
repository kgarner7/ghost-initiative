/* eslint-disable max-classes-per-file */
import { Button, Col, Form, InputNumber, List, message, Modal, Row } from "antd";
import Checkbox from "antd/lib/checkbox/Checkbox";
import { Fragment, h } from "preact";
// eslint-disable-next-line import/no-internal-modules
import { PureComponent } from "preact/compat";

import type { CharacterUpdate, ClientSocket, PartialBy, SocketCharacter } from "../server/socket";

import type { PlayerMap } from "./app";

// eslint-disable-next-line @typescript-eslint/no-type-alias
interface CharacterProps extends PartialBy<SocketCharacter, "initiative"> {
  admin: boolean;
  me: boolean;
  socket: ClientSocket;
}

interface CharacterState {
  editing: boolean;
}

class Character extends PureComponent<CharacterProps, CharacterState> {
  public constructor(props: CharacterProps) {
    super(props);

    this.state = { editing: false };

    this.cancelEdit = this.cancelEdit.bind(this);
    this.delete     = this.delete.bind(this);
    this.startEdit  = this.startEdit.bind(this);
    this.submit     = this.submit.bind(this);
  }

  public render(): h.JSX.Element {
    const additionalInfo: h.JSX.Element[] = [];

    if (this.props.admin && this.state.editing) {
      additionalInfo.push(<Form layout="inline" onFinish={this.submit}>
        <Form.Item
          label="Dexterity" name="dex" initialValue={this.props.dex}
          rules={[{
            required: true, message: "Please enter a valid dexterity score [1-5]"
          }]}
        >
          <InputNumber min={1} max={5}/>
        </Form.Item>
        <Form.Item
          label="Wits" name="wis" initialValue={this.props.wis}
          rules={[{
            required: true, message: "Please enter a valid wits score [1-5]"
          }]}
        >
          <InputNumber min={1} max={5}/>
        </Form.Item>
        <Form.Item
          label="Roll" name="roll" initialValue={this.props.roll ?? undefined}
          rules={[{
            required: false, message: "Please enter a valid roll [1-10]"
          }]}
        >
          <InputNumber min={1} max={10}/>
        </Form.Item>
        {!this.props.player && <Form.Item
          name="hidden" valuePropName="checked" initialValue={this.props.hidden ?? false}
        >
          <Checkbox>Hidden</Checkbox>
        </Form.Item>}
        <Form.Item>
          <Button type="primary" htmlType="submit">Submit</Button>
        </Form.Item>
      </Form>);
    } else {
      if (this.props.dex) {
        additionalInfo.push(<Col flex={1}>
          Dex: {this.props.dex}
        </Col>);
      }

      if (this.props.wis) {
        additionalInfo.push(<Col flex={1}>
          Wits: {this.props.wis}
        </Col>);
      }

      if (this.props.roll !== undefined) {
        additionalInfo.push(<Col flex={1}>
          Current roll: {this.props.roll ?? "--"}
        </Col>);
      }

      if (this.props.hidden !== undefined) {
        additionalInfo.push(<Col flex={1}>
          Hidden: {this.props.hidden ? "yes": "no"}
        </Col>);
      }
    }

    let buttons: h.JSX.Element[] | undefined;

    if (this.props.admin) {
      if (this.state.editing) {
        buttons = [<Button type="primary" danger onClick={this.cancelEdit} key="cancel">
          Cancel
        </Button>];
      } else {
        buttons = [
          <Button type="primary" onClick={this.startEdit} key="edit">Edit</Button>,
          <Button type="primary" onClick={this.delete} key="delete" danger>Delete</Button>
        ];
      }
    }

    return <List.Item
      className={`character${this.props.me ? " me": ""}`}
      actions={buttons}
    >
      <List.Item.Meta
        title={<h2>
          <strong>{this.props.name}</strong>&nbsp;
          <span>({this.props.me ? "you": this.props.player ? "player": "npc"})</span>
        </h2>}
        description={<Row className="allStats">{additionalInfo}</Row>}
      />
      <h2 className="init">
        Initiative: {this.props.initiative ?? "--"}
      </h2>
    </List.Item>;
  }

  private cancelEdit(): void {
    this.setState({ editing: false });
  }

  private delete(): void {
    Modal.confirm({
      okType: "danger",
      content: this.props.player ? <h2>
        <strong>Warning: {this.props.name} is a player character</strong>.
        Please be sure you want to remove this character.
      </h2>: `Are you sure you want to delete the NPC ${this.props.name}?`,
      onOk: () => {
        this.props.socket.emit("delete", this.props.name, error => {
          if (error) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            message.error(`Could not delete ${error}`);
          }
        });
      }
    });
  }

  private startEdit(): void {
    this.setState({ editing: true });
  }

  private submit(data: CharacterUpdate): void {
    const errors: string[] = [];

    if (typeof data.dex !== "number" || data.dex < 1 || data.dex > 5) {
      errors.push("Dexterty must be between 1 and 5 (inclusive");
    }

    if (typeof data.wis !== "number" || data.wis < 1 || data.wis > 5) {
      errors.push("Wits must be between 1 and 5 (inclusive");
    }

    if (data.roll !== undefined && data.roll !== null  && (
      typeof data.roll !== "number" || data.roll < 1 || data.roll > 10)) {
      errors.push("Initiative roll must be between 1 and 10 (inclusive)");
    }

    if (errors.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      message.error(`Could not update ${this.props.name}:\n${errors.join("\n")}`);
    } else {
      this.props.socket.emit("update", this.props.name, data, error => {
        if (error) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          message.error(error);
        } else {
          this.setState({ editing: false });
        }
      });
    }
  }
}

export interface TrackerProps {
  admin: boolean;
  name?: string;
  order: string[];
  players: PlayerMap;
  socket: ClientSocket;
}

export class Tracker extends PureComponent<TrackerProps> {
  public constructor(props: TrackerProps) {
    super(props);

    this.state = {};
  }

  public render(): h.JSX.Element {
    const data = this.props.order.map(name => {
      const player = this.props.players.get(name)!;

      return { ...player, name };
    });

    return <List bordered dataSource={data} renderItem={item =>
      (<Character admin={this.props.admin} me={item.name === this.props.name}
        socket={this.props.socket} {...item} />)}/>;
  }
}

