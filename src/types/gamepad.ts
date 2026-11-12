export type ControllerButton =
  | 'A'
  | 'B'
  | 'X'
  | 'Y'
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'L1'
  | 'R1'
  | 'L2'
  | 'R2'
  | 'L3'
  | 'R3'
  | 'START'
  | 'SELECT'
  | 'HOME';

export interface ControllerInfo {
  id: string;
  vendorName: string;
  isAttachedToDevice: boolean;
  batteryLevel?: number;
  hasBattery: boolean;
  playerIndex: number;
}

export interface GamepadButtonEvent {
  button: ControllerButton;
  pressed: boolean;
  value: number;
}

export interface GamepadThumbstickEvent {
  axis: 'left' | 'right';
  x: number;
  y: number;
}
