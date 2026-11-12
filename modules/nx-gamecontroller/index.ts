import { requireNativeModule, EventEmitter, type EventSubscription } from 'expo-modules-core';
import { ControllerInfo, GamepadButtonEvent, GamepadThumbstickEvent } from '../../src/types/gamepad';

type NxEvents = {
  onControllerConnected: (controller: ControllerInfo) => void;
  onControllerDisconnected: (info: { id: string; vendorName: string }) => void;
  onButtonPress: (event: GamepadButtonEvent) => void;
  onThumbstickMove: (event: GamepadThumbstickEvent) => void;
};

let NxGameController: any = null;
let emitter: EventEmitter<NxEvents> | null = null;

try {
  NxGameController = requireNativeModule('NxGameController');
  if (NxGameController) {
    emitter = new EventEmitter<NxEvents>(NxGameController);
  }
} catch (e) {
  // Gracefully fallback when running in Expo Go or non-native builds
}

export function isGamepadModuleAvailable(): boolean {
  return !!NxGameController;
}

export function getConnectedControllers(): ControllerInfo[] {
  if (!NxGameController) return [];
  try {
    return NxGameController.getConnectedControllers();
  } catch (e) {
    console.warn('[NxGameController] getConnectedControllers error:', e);
    return [];
  }
}

export function setDeadzone(deadzone: number): void {
  if (!NxGameController) return;
  NxGameController.setDeadzone(deadzone);
}

export function addControllerConnectListener(
  listener: (controller: ControllerInfo) => void
): EventSubscription | null {
  return emitter?.addListener('onControllerConnected', listener) ?? null;
}

export function addControllerDisconnectListener(
  listener: (info: { id: string; vendorName: string }) => void
): EventSubscription | null {
  return emitter?.addListener('onControllerDisconnected', listener) ?? null;
}

export function addButtonPressListener(
  listener: (event: GamepadButtonEvent) => void
): EventSubscription | null {
  return emitter?.addListener('onButtonPress', listener) ?? null;
}

export function addThumbstickMoveListener(
  listener: (event: GamepadThumbstickEvent) => void
): EventSubscription | null {
  return emitter?.addListener('onThumbstickMove', listener) ?? null;
}
