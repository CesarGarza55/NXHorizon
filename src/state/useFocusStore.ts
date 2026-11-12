import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { FocusContext } from '../types/game';

export type FocusZone = 'carousel' | 'dock';

interface FocusState {
  currentContext: FocusContext;
  focusedNodeId: string | null;
  activeScreen: 'home' | 'library' | 'details' | 'settings';
  isGamepadActive: boolean;
  focusZone: FocusZone;
  focusedDockIndex: number;

  // Actions
  setContext: (context: FocusContext) => void;
  setActiveScreen: (screen: 'home' | 'library' | 'details' | 'settings') => void;
  setFocusedNode: (nodeId: string | null, fromGamepad?: boolean) => void;
  setGamepadActive: (active: boolean) => void;
  setFocusZone: (zone: FocusZone) => void;
  setFocusedDockIndex: (index: number) => void;
  triggerHaptic: () => void;
}

export const useFocusStore = create<FocusState>((set, get) => ({
  currentContext: 'home',
  focusedNodeId: null,
  activeScreen: 'home',
  isGamepadActive: false,
  focusZone: 'carousel',
  focusedDockIndex: 2, // Default to Album/Library (center)

  setContext: (context) => set({ currentContext: context }),
  setActiveScreen: (screen) => {
    set({
      activeScreen: screen,
      currentContext: screen as FocusContext,
      focusZone: 'carousel',
    });
  },

  setFocusedNode: (nodeId, fromGamepad = false) => {
    const prev = get().focusedNodeId;
    if (prev !== nodeId) {
      set({
        focusedNodeId: nodeId,
        isGamepadActive: fromGamepad ? true : get().isGamepadActive,
      });
      // Immediate haptic response on item selection / focus transition
      Haptics.selectionAsync().catch(() => {});
    }
  },

  setGamepadActive: (active) => set({ isGamepadActive: active }),

  setFocusZone: (zone) => {
    const prev = get().focusZone;
    if (prev !== zone) {
      set({ focusZone: zone, isGamepadActive: true });
      Haptics.selectionAsync().catch(() => {});
    }
  },

  setFocusedDockIndex: (index) => {
    const prev = get().focusedDockIndex;
    if (prev !== index) {
      set({ focusedDockIndex: index, isGamepadActive: true });
      Haptics.selectionAsync().catch(() => {});
    }
  },

  triggerHaptic: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
}));
