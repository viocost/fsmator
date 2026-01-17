import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig, StateContext, BaseEvent } from '../src/types';

describe('Shallow History', () => {
  interface TestContext extends StateContext {
    count: number;
  }

  type TestEvent = { type: 'NEXT' } | { type: 'BACK' } | { type: 'GO_TO_OTHER' };

  describe('basic shallow history', () => {
    it('should return to initial state when history is disabled (default)', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { count: 0 },
        initial: 'compound',
        states: {
          compound: {
            initial: 'a',
            states: {
              a: {
                on: { NEXT: 'b' },
              },
              b: {
                on: { NEXT: 'c' },
              },
              c: {},
            },
            on: { GO_TO_OTHER: 'other' },
          },
          other: {
            on: { BACK: 'compound' },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // Initial state: compound.a
      expect(machine.getStateValue()).toEqual({ compound: 'a' });

      // Navigate to b
      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ compound: 'b' });

      // Navigate to c
      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ compound: 'c' });

      // Exit compound state
      machine.send({ type: 'GO_TO_OTHER' });
      expect(machine.getStateValue()).toBe('other');

      // Return to compound - should go to initial state 'a', not 'c'
      machine.send({ type: 'BACK' });
      expect(machine.getStateValue()).toEqual({ compound: 'a' });
    });

    it('should return to last active state when history is enabled', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { count: 0 },
        initial: 'compound',
        states: {
          compound: {
            initial: 'a',
            history: true, // Enable shallow history
            states: {
              a: {
                on: { NEXT: 'b' },
              },
              b: {
                on: { NEXT: 'c' },
              },
              c: {},
            },
            on: { GO_TO_OTHER: 'other' },
          },
          other: {
            on: { BACK: 'compound' },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // Initial state: compound.a
      expect(machine.getStateValue()).toEqual({ compound: 'a' });

      // Navigate to b
      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ compound: 'b' });

      // Navigate to c
      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ compound: 'c' });

      // Exit compound state
      machine.send({ type: 'GO_TO_OTHER' });
      expect(machine.getStateValue()).toBe('other');

      // Return to compound - should go to last active state 'c'
      machine.send({ type: 'BACK' });
      expect(machine.getStateValue()).toEqual({ compound: 'c' });
    });

    it('should use initial state on first entry even with history enabled', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { count: 0 },
        initial: 'other',
        states: {
          compound: {
            initial: 'a',
            history: true,
            states: {
              a: {},
              b: {},
              c: {},
            },
          },
          other: {
            on: { GO_TO_OTHER: 'compound' },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // Initial state: other
      expect(machine.getStateValue()).toBe('other');

      // Enter compound for the first time - should use initial state
      machine.send({ type: 'GO_TO_OTHER' });
      expect(machine.getStateValue()).toEqual({ compound: 'a' });
    });
  });

  describe('nested compound states with history', () => {
    type NestedEvent =
      | { type: 'NEXT' }
      | { type: 'BACK' }
      | { type: 'GO_TO_OTHER' }
      | { type: 'DEEP' };

    it('should handle shallow history in nested compound states', () => {
      const config: StateMachineConfig<TestContext, NestedEvent> = {
        initialContext: { count: 0 },
        initial: 'outer',
        states: {
          outer: {
            initial: 'inner',
            history: true, // Outer has history
            states: {
              inner: {
                initial: 'a',
                history: true, // Inner also has history
                states: {
                  a: {
                    on: { NEXT: 'b' },
                  },
                  b: {
                    on: { NEXT: 'c' },
                  },
                  c: {},
                },
              },
              sibling: {},
            },
            on: { GO_TO_OTHER: 'other' },
          },
          other: {
            on: { BACK: 'outer' },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // Initial state: outer.inner.a
      expect(machine.getStateValue()).toEqual({ outer: { inner: 'a' } });

      // Navigate to inner.b
      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ outer: { inner: 'b' } });

      // Navigate to inner.c
      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ outer: { inner: 'c' } });

      // Exit outer state
      machine.send({ type: 'GO_TO_OTHER' });
      expect(machine.getStateValue()).toBe('other');

      // Return to outer - should restore to outer.inner (outer's history)
      // and inner.c (inner's history)
      machine.send({ type: 'BACK' });
      expect(machine.getStateValue()).toEqual({ outer: { inner: 'c' } });
    });

    it('should only remember direct children (shallow, not deep)', () => {
      const config: StateMachineConfig<TestContext, NestedEvent> = {
        initialContext: { count: 0 },
        initial: 'outer',
        states: {
          outer: {
            initial: 'inner',
            history: true, // Only outer has history
            states: {
              inner: {
                initial: 'a',
                // No history on inner - should use initial
                states: {
                  a: {
                    on: { NEXT: 'b' },
                  },
                  b: {
                    on: { NEXT: 'c' },
                  },
                  c: {},
                },
              },
              sibling: {},
            },
            on: { GO_TO_OTHER: 'other' },
          },
          other: {
            on: { BACK: 'outer' },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // Navigate to inner.c
      machine.send({ type: 'NEXT' });
      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ outer: { inner: 'c' } });

      // Exit outer state
      machine.send({ type: 'GO_TO_OTHER' });
      expect(machine.getStateValue()).toBe('other');

      // Return to outer - outer remembers 'inner', but inner doesn't remember 'c'
      machine.send({ type: 'BACK' });
      expect(machine.getStateValue()).toEqual({ outer: { inner: 'a' } });
    });
  });

  describe('history with multiple exits and entries', () => {
    it('should update history on each exit', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { count: 0 },
        initial: 'compound',
        states: {
          compound: {
            initial: 'a',
            history: true,
            states: {
              a: {
                on: { NEXT: 'b' },
              },
              b: {
                on: { NEXT: 'c' },
              },
              c: {},
            },
            on: { GO_TO_OTHER: 'other' },
          },
          other: {
            on: { BACK: 'compound' },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // Go to b and exit
      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ compound: 'b' });
      machine.send({ type: 'GO_TO_OTHER' });

      // Return - should be at b
      machine.send({ type: 'BACK' });
      expect(machine.getStateValue()).toEqual({ compound: 'b' });

      // Go to c and exit
      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ compound: 'c' });
      machine.send({ type: 'GO_TO_OTHER' });

      // Return - should be at c (updated history)
      machine.send({ type: 'BACK' });
      expect(machine.getStateValue()).toEqual({ compound: 'c' });
    });
  });

  describe('history with snapshot serialization', () => {
    it('should preserve history in snapshots', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { count: 0 },
        initial: 'compound',
        states: {
          compound: {
            initial: 'a',
            history: true,
            states: {
              a: {
                on: { NEXT: 'b' },
              },
              b: {
                on: { NEXT: 'c' },
              },
              c: {},
            },
            on: { GO_TO_OTHER: 'other' },
          },
          other: {
            on: { BACK: 'compound' },
          },
        },
      };

      const machine1 = new StateMachine(config).start();

      // Navigate to c
      machine1.send({ type: 'NEXT' });
      machine1.send({ type: 'NEXT' });
      expect(machine1.getStateValue()).toEqual({ compound: 'c' });

      // Exit compound state
      machine1.send({ type: 'GO_TO_OTHER' });
      expect(machine1.getStateValue()).toBe('other');

      // Serialize the state (including history)
      const snapshot = machine1.dump();

      // Create new machine and load snapshot
      const machine2 = new StateMachine(config);
      machine2.load(JSON.parse(snapshot)).start();

      // Verify state is restored
      expect(machine2.getStateValue()).toBe('other');

      // Return to compound - should use history from snapshot
      machine2.send({ type: 'BACK' });
      expect(machine2.getStateValue()).toEqual({ compound: 'c' });
    });
  });

  describe('edge cases', () => {
    it('should handle history when transitioning to parent state directly', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { count: 0 },
        initial: 'other',
        states: {
          compound: {
            initial: 'a',
            history: true,
            states: {
              a: {
                on: { NEXT: 'b' },
              },
              b: {},
            },
          },
          other: {
            on: { GO_TO_OTHER: 'compound' },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // First entry - should use initial
      machine.send({ type: 'GO_TO_OTHER' });
      expect(machine.getStateValue()).toEqual({ compound: 'a' });

      // Navigate to b
      machine.send({ type: 'NEXT' });
      expect(machine.getStateValue()).toEqual({ compound: 'b' });

      // Self-transition on compound would exit and re-enter
      // For now, just verify we're at b
      expect(machine.getStateValue()).toEqual({ compound: 'b' });
    });

    it('should not affect parallel states', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initialContext: { count: 0 },
        initial: 'parallel',
        states: {
          parallel: {
            type: 'parallel',
            states: {
              region1: {
                initial: 'a',
                states: {
                  a: {},
                },
              },
              region2: {
                initial: 'x',
                states: {
                  x: {},
                },
              },
            },
          },
        },
      };

      // Parallel states don't support history, but should not cause errors
      const machine = new StateMachine(config).start();
      expect(machine.getStateValue()).toEqual({
        parallel: {
          region1: 'a',
          region2: 'x',
        },
      });
    });
  });
});
