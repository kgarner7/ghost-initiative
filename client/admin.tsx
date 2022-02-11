/* eslint-disable max-classes-per-file */
import {
  Button, Card, Checkbox, Col, Form, Input, InputNumber, List, message, Modal, Row
} from "antd";
import produce from "immer";
import { Fragment, h } from "preact";
import { PureComponent } from "preact/compat";

import type { CharacterCreate, ClientSocket } from "../server/socket";

interface NewCharacterProps {
  id: number;
  create: (data: CharacterCreate) => void;
  remove: (id: number) => void;
}

class NewCharacter extends PureComponent<NewCharacterProps> {
  public render(): h.JSX.Element {
    return <List.Item>
      <Form layout="inline" onFinish={this.props.create}>
        <Form.Item
          label="Name" name="name"
          rules={[{ required: true, message: "Please provide your character name" }]}
        >
          <Input placeholder="Character's name" />
        </Form.Item>
        <Form.Item
          label="Dexterity" name="dex" initialValue={1}
          rules={[{ required: true, message: "Please provide a dexterity score [1,5]" }]}
        >
          <InputNumber min={1} max={5}/>
        </Form.Item>
        <Form.Item
          label="Wits" name="wis" initialValue={1}
          rules={[{ required: true, message: "Please provide a wits score [1, 5]" }]}
        >
          <InputNumber min={1} max={5}/>
        </Form.Item>
        <Form.Item label="Roll" name="roll" initialValue={undefined}>
          <InputNumber min={1} max={10} placeholder="1d10"/>
        </Form.Item>
        <Form.Item name="hidden" valuePropName="checked" initialValue={true}>
          <Checkbox>Hidden</Checkbox>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">Submit</Button>
        </Form.Item>
        <Form.Item>
          <Button type="primary" danger
            onClick={(): void => this.props.remove(this.props.id)}
          >Cancel</Button>
        </Form.Item>
      </Form>
    </List.Item>;
  }
}

export interface AdminProps {
  socket: ClientSocket;
  handleLogout: () => void;
}

export interface AdminState {
  ids: number[];
  nextId: number;
}

export class Admin extends PureComponent<AdminProps, AdminState> {
  public constructor(props: AdminProps) {
    super(props);

    this.handleRoll = this.handleRoll.bind(this);
    this.newNpc     = this.newNpc.bind(this);
    this.removeNpc  = this.removeNpc.bind(this);

    this.state = { ids: [], nextId: 0 };
  }

  public render(): h.JSX.Element {
    return <Card title={<h2>Welcome GM!</h2>} extra={
      <Button type="primary" onClick={this.props.handleLogout}>Log out</Button>
    }>
      <Row>
        <Col flex={1}>
          <Button
            type="primary" danger className="roll"
            onClick={this.handleRoll}
          >Reroll all initiatives</Button>
        </Col>
        <Col flex={1}>
          <Button type="primary" className="roll" onClick={this.newNpc}>Add NPC</Button>
        </Col>
      </Row>
      { this.state.ids.length > 0 && <List
        dataSource={this.state.ids} renderItem={id =>
          <NewCharacter id={id} key={id} create={this.createNpc(id)} remove={this.removeNpc} />}/>}
    </Card>;
  }

  private handleRoll(): void {
    Modal.confirm({
      content: "Are you sure you want to reroll intiative?",
      onOk: () => {
        this.props.socket.emit("roll", error => {
          if (error) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            message.error(`Could not reroll everyone: ${error}`);
          }
        });
      }
    });
  }

  private createNpc(id: number): (data: CharacterCreate) => void {
    return data => {
      const errors: string[] = [];

      if (typeof data.dex !== "number" || data.dex < 1 || data.dex > 5) {
        errors.push("Dexterty must be between 1 and 5 (inclusive");
      }

      if (typeof data.wis !== "number" || data.wis < 1 || data.wis > 5) {
        errors.push("Wits must be between 1 and 5 (inclusive");
      }

      if (data.roll === undefined) {
        data.roll = null;
      }

      if (data.roll !== null && (
        typeof data.roll !== "number" || data.roll < 1 || data.roll > 10)) {
        errors.push("Initiative roll must be between 1 and 10 (inclusive)");
      }

      if (typeof data.name !== "string") {
        errors.push("Character name must be a string");
      }

      if (data.hidden !== null && typeof data.hidden !== "boolean") {
        errors.push("Hidden must be a boolean (or null)");
      }

      if (errors.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.error(`Could not create character:\n${errors.join("\n")}`);
      } else {
        this.props.socket.emit("create", data, error => {
          if (error) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            message.error(`Could not create character: ${error}`);
          } else {
            this.removeNpc(id);
          }
        });
      }
    };
  }

  private newNpc(): void {
    this.setState(state => produce(state, draft => {
      const nextId = draft.nextId + 1;
      draft.nextId = nextId;
      draft.ids.push(nextId);
    }));
  }

  private removeNpc(id: number): void {
    this.setState(state => ({
      ids: state.ids.filter(old => old !== id)
    }));
  }
}
