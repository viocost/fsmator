import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig, StateContext } from '../src/types';

interface TestContext extends StateContext {
  value: number;
}

type TestEvent =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SUBMIT' }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'MUTE' }
  | { type: 'UNMUTE' };

describe('StateMachine.getStateValue()', () => {
  describe('atomic states', () => {
    it('should return string for simple atomic state', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'idle',
        states: {
          idle: {
            on: { NEXT: 'active' },
          },
          active: {},
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getStateValue()).toBe('idle');
    });

    it('should return string after transitioning to another atomic state', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'idle',
        states: {
          idle: {
            on: { NEXT: 'active' },
          },
          active: {
            on: { BACK: 'idle' },
          },
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toBe('active');

      machine.send({ type: 'BACK' });
      expect(machine.getStateValue()).toBe('idle');
    });
  });

  describe('compound states (nested hierarchy)', () => {
    it('should return nested object for compound state with one level', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'form',
        states: {
          form: {
            initial: 'editing',
            states: {
              editing: {
                on: { NEXT: 'validating' },
              },
              validating: {},
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getStateValue()).toEqual({ form: 'editing' });
    });

    it('should update nested state value after transition', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'form',
        states: {
          form: {
            initial: 'editing',
            states: {
              editing: {
                on: { NEXT: 'validating' },
              },
              validating: {
                on: { BACK: 'editing' },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getStateValue()).toEqual({ form: 'editing' });

      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ form: 'validating' });

      machine.send({ type: 'BACK' });
      expect(machine.getStateValue()).toEqual({ form: 'editing' });
    });

    it('should return deeply nested object for multi-level compound states', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'app',
        states: {
          app: {
            initial: 'form',
            states: {
              form: {
                initial: 'editing',
                states: {
                  editing: {
                    on: { NEXT: 'validating' },
                  },
                  validating: {
                    on: { SUBMIT: 'submitting' },
                  },
                  submitting: {},
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getStateValue()).toEqual({
        app: {
          form: 'editing',
        },
      });

      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({
        app: {
          form: 'validating',
        },
      });

      machine.send({ type: 'SUBMIT' });
      expect(machine.getStateValue()).toEqual({
        app: {
          form: 'submitting',
        },
      });
    });

    it('should handle transitions between sibling compound states', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'stateA',
        states: {
          stateA: {
            initial: 'childA1',
            states: {
              childA1: {
                on: { NEXT: 'stateB' },
              },
            },
          },
          stateB: {
            initial: 'childB1',
            states: {
              childB1: {
                on: { BACK: 'stateA' },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getStateValue()).toEqual({ stateA: 'childA1' });

      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ stateB: 'childB1' });

      machine.send({ type: 'BACK' });
      expect(machine.getStateValue()).toEqual({ stateA: 'childA1' });
    });
  });

  describe('parallel states', () => {
    it('should return object with all active regions for parallel state', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'player',
        states: {
          player: {
            states: {
              playback: {
                initial: 'stopped',
                states: {
                  stopped: {
                    on: { PLAY: 'playing' },
                  },
                  playing: {
                    on: { PAUSE: 'paused' },
                  },
                  paused: {},
                },
              },
              volume: {
                initial: 'normal',
                states: {
                  normal: {
                    on: { MUTE: 'muted' },
                  },
                  muted: {
                    on: { UNMUTE: 'normal' },
                  },
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getStateValue()).toEqual({
        player: {
          playback: 'stopped',
          volume: 'normal',
        },
      });
    });

    it('should update one region independently in parallel state', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'player',
        states: {
          player: {
            states: {
              playback: {
                initial: 'stopped',
                states: {
                  stopped: {
                    on: { PLAY: 'playing' },
                  },
                  playing: {
                    on: { PAUSE: 'paused' },
                  },
                  paused: {},
                },
              },
              volume: {
                initial: 'normal',
                states: {
                  normal: {
                    on: { MUTE: 'muted' },
                  },
                  muted: {
                    on: { UNMUTE: 'normal' },
                  },
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // Change playback, volume stays same
      machine.send({ type: 'PLAY' });
      expect(machine.getStateValue()).toEqual({
        player: {
          playback: 'playing',
          volume: 'normal',
        },
      });

      // Change volume, playback stays same
      machine.send({ type: 'MUTE' });
      expect(machine.getStateValue()).toEqual({
        player: {
          playback: 'playing',
          volume: 'muted',
        },
      });

      // Change both
      machine.send({ type: 'PAUSE' });
      expect(machine.getStateValue()).toEqual({
        player: {
          playback: 'paused',
          volume: 'muted',
        },
      });

      machine.send({ type: 'UNMUTE' });
      expect(machine.getStateValue()).toEqual({
        player: {
          playback: 'paused',
          volume: 'normal',
        },
      });
    });

    it('should handle nested compound states within parallel regions', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'app',
        states: {
          app: {
            states: {
              regionA: {
                initial: 'container',
                states: {
                  container: {
                    initial: 'itemA',
                    states: {
                      itemA: {
                        on: { NEXT: 'itemB' },
                      },
                      itemB: {},
                    },
                  },
                },
              },
              regionB: {
                initial: 'idle',
                states: {
                  idle: {
                    on: { PLAY: 'active' },
                  },
                  active: {},
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getStateValue()).toEqual({
        app: {
          regionA: {
            container: 'itemA',
          },
          regionB: 'idle',
        },
      });

      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({
        app: {
          regionA: {
            container: 'itemB',
          },
          regionB: 'idle',
        },
      });

      machine.send({ type: 'PLAY' });
      expect(machine.getStateValue()).toEqual({
        app: {
          regionA: {
            container: 'itemB',
          },
          regionB: 'active',
        },
      });
    });
  });

  describe('mixed hierarchies', () => {
    it('should handle transition from atomic to compound state', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'idle',
        states: {
          idle: {
            on: { NEXT: 'form' },
          },
          form: {
            initial: 'editing',
            states: {
              editing: {},
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getStateValue()).toBe('idle');

      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ form: 'editing' });
    });

    it('should handle transition from compound to atomic state', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'form',
        states: {
          form: {
            initial: 'editing',
            states: {
              editing: {
                on: { SUBMIT: 'success' },
              },
            },
          },
          success: {},
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getStateValue()).toEqual({ form: 'editing' });

      machine.send({ type: 'SUBMIT' });
      expect(machine.getStateValue()).toBe('success');
    });

    it('should handle transition from compound to parallel state', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'form',
        states: {
          form: {
            initial: 'editing',
            states: {
              editing: {
                on: { SUBMIT: 'player' },
              },
            },
          },
          player: {
            states: {
              playback: {
                initial: 'stopped',
                states: {
                  stopped: {},
                },
              },
              volume: {
                initial: 'normal',
                states: {
                  normal: {},
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getStateValue()).toEqual({ form: 'editing' });

      machine.send({ type: 'SUBMIT' });
      expect(machine.getStateValue()).toEqual({
        player: {
          playback: 'stopped',
          volume: 'normal',
        },
      });
    });
  });

  describe('edge cases', () => {
    it('should handle final states', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'active',
        states: {
          active: {
            on: { SUBMIT: 'done' },
          },
          done: {
            type: 'final',
          },
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getStateValue()).toBe('active');

      machine.send({ type: 'SUBMIT' });
      expect(machine.getStateValue()).toBe('done');
      expect(machine.isHalted()).toBe(true);
    });

    it('should handle final states within compound hierarchy', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { value: 0 },
        initial: 'workflow',
        states: {
          workflow: {
            initial: 'step1',
            states: {
              step1: {
                on: { NEXT: 'step2' },
              },
              step2: {
                on: { SUBMIT: 'complete' },
              },
              complete: {
                type: 'final',
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getStateValue()).toEqual({ workflow: 'step1' });

      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ workflow: 'step2' });

      machine.send({ type: 'SUBMIT' });
      expect(machine.getStateValue()).toEqual({ workflow: 'complete' });
      expect(machine.isHalted()).toBe(true);
    });
  });
});
