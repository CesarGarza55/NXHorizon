import { useEffect, useState, useCallback, useRef } from 'react';
import {
  addControllerConnectListener,
  addControllerDisconnectListener,
  addButtonPressListener,
  addThumbstickMoveListener,
  getConnectedControllers,
  isGamepadModuleAvailable,
} from '../../modules/nx-gamecontroller';
import { ControllerInfo, ControllerButton } from '../types/gamepad';
import { useFocusStore } from '../state/useFocusStore';
import { useGameStore } from '../state/useGameStore';

export interface UseGamepadOptions {
  onButtonPress?: (button: ControllerButton) => void;
  onDirection?: (dir: 'left' | 'right' | 'up' | 'down') => void;
  onSelect?: () => void;
  onBack?: () => void;
  onOptions?: () => void;
}

export function useGamepad(options?: UseGamepadOptions) {
  const [controllers, setControllers] = useState<ControllerInfo[]>([]);
  const [lastPressedButton, setLastPressedButton] = useState<ControllerButton | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const {
    activeScreen,
    setActiveScreen,
    setFocusedNode,
    setGamepadActive,
    triggerHaptic,
  } = useFocusStore();

  const { games, selectedGameId, setSelectedGame } = useGameStore();

  const handleDirection = useCallback(
    (dir: 'left' | 'right' | 'up' | 'down') => {
      setGamepadActive(true);

      if (optionsRef.current?.onDirection) {
        optionsRef.current.onDirection(dir);
        return;
      }

      if (games.length === 0) return;

      const currentIndex = games.findIndex((g) => g.id === selectedGameId);

      if (dir === 'left') {
        if (currentIndex > 0) {
          const prevGame = games[currentIndex - 1];
          setSelectedGame(prevGame.id);
          setFocusedNode(prevGame.id, true);
        } else if (currentIndex === -1 && games.length > 0) {
          setSelectedGame(games[0].id);
          setFocusedNode(games[0].id, true);
        }
      } else if (dir === 'right') {
        if (currentIndex < games.length - 1 && currentIndex >= 0) {
          const nextGame = games[currentIndex + 1];
          setSelectedGame(nextGame.id);
          setFocusedNode(nextGame.id, true);
        } else if (currentIndex === -1 && games.length > 0) {
          setSelectedGame(games[0].id);
          setFocusedNode(games[0].id, true);
        }
      }
    },
    [games, selectedGameId, setSelectedGame, setFocusedNode, setGamepadActive]
  );

  const handleButton = useCallback(
    (button: ControllerButton) => {
      setLastPressedButton(button);
      setGamepadActive(true);
      triggerHaptic();

      // Trigger custom callback if provided
      optionsRef.current?.onButtonPress?.(button);

      switch (button) {
        case 'LEFT':
          handleDirection('left');
          break;
        case 'RIGHT':
          handleDirection('right');
          break;
        case 'UP':
          handleDirection('up');
          break;
        case 'DOWN':
          handleDirection('down');
          break;
        case 'A':
          optionsRef.current?.onSelect?.();
          break;
        case 'B':
          optionsRef.current?.onBack?.();
          break;
        case 'X':
        case 'START':
        case 'SELECT':
          optionsRef.current?.onOptions?.();
          break;
        case 'L1':
          if (activeScreen === 'settings') setActiveScreen('library');
          else if (activeScreen === 'library') setActiveScreen('home');
          break;
        case 'R1':
          if (activeScreen === 'home') setActiveScreen('library');
          else if (activeScreen === 'library') setActiveScreen('settings');
          break;
        default:
          break;
      }
    },
    [handleDirection, activeScreen, setActiveScreen, setGamepadActive, triggerHaptic]
  );

  useEffect(() => {
    // 1. Initial controllers poll
    const initial = getConnectedControllers();
    setControllers(initial);

    // 2. Subscriptions
    const subConnect = addControllerConnectListener((c) => {
      setControllers((prev) => [...prev.filter((item) => item.id !== c.id), c]);
    });

    const subDisconnect = addControllerDisconnectListener((info) => {
      setControllers((prev) => prev.filter((item) => item.id !== info.id));
    });

    const subButton = addButtonPressListener((event) => {
      if (event.pressed) {
        handleButton(event.button);
      }
    });

    // Thumbstick deadzone navigation with cooldown
    let lastStickMove = 0;
    const subStick = addThumbstickMoveListener((event) => {
      if (event.axis === 'left') {
        const now = Date.now();
        if (now - lastStickMove > 200) {
          if (event.x < -0.45) {
            handleDirection('left');
            lastStickMove = now;
          } else if (event.x > 0.45) {
            handleDirection('right');
            lastStickMove = now;
          } else if (event.y > 0.45) {
            handleDirection('up');
            lastStickMove = now;
          } else if (event.y < -0.45) {
            handleDirection('down');
            lastStickMove = now;
          }
        }
      }
    });

    return () => {
      subConnect?.remove();
      subDisconnect?.remove();
      subButton?.remove();
      subStick?.remove();
    };
  }, [handleButton, handleDirection]);

  return {
    controllers,
    activeController: controllers[0] || null,
    isConnected: controllers.length > 0,
    lastPressedButton,
    isNativeModuleReady: isGamepadModuleAvailable(),
    simulateButtonPress: handleButton,
  };
}
