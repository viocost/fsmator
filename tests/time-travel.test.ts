import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';

describe('Time Travel', () => {
  describe('Configuration', () => {
    it('should throw when using rewind without timeTravel enabled', () => {
      type Context = Record<string, never>;
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'a',
        states: {
          a: { on: { GO: { target: 'b' } } },
          b: {},
        },
      };

      const machine = new StateMachine(config).start();

      expect(() => machine.rewind()).toThrow('Time travel not enabled');
    });

    it('should throw when using ff without timeTravel enabled', () => {
      type Context = Record<string, never>;
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'a',
        states: {
          a: { on: { GO: { target: 'b' } } },
          b: {},
        },
      };

      const machine = new StateMachine(config).start();

      expect(() => machine.ff()).toThrow('Time travel not enabled');
    });

    it('should throw when rewinding before machine is started', () => {
      type Context = Record<string, never>;
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'a',
        timeTravel: true,
        states: {
          a: {},
        },
      };

      const machine = new StateMachine(config);

      expect(() => machine.rewind()).toThrow('machine not started');
    });
  });

  describe('Basic Rewind', () => {
    it('should rewind one step', () => {
      type Context = { count: number };
      type Event = { type: 'INC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'active',
        timeTravel: true,
        states: {
          active: {
            on: { INC: { assign: 'increment' } },
          },
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine = new StateMachine(config).start();
      // History: [0]

      machine.send({ type: 'INC' }); // count = 1
      // History: [0, 1]

      machine.send({ type: 'INC' }); // count = 2
      // History: [0, 1, 2]

      expect(machine.getContext().count).toBe(2);
      expect(machine.getHistoryIndex()).toBe(2);
      expect(machine.getHistoryLength()).toBe(3);

      machine.rewind(); // Back to count = 1
      expect(machine.getContext().count).toBe(1);
      expect(machine.getHistoryIndex()).toBe(1);
    });

    it('should rewind multiple steps', () => {
      type Context = { count: number };
      type Event = { type: 'INC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'active',
        timeTravel: true,
        states: {
          active: {
            on: { INC: { assign: 'increment' } },
          },
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine = new StateMachine(config).start();

      machine.send({ type: 'INC' }); // count = 1
      machine.send({ type: 'INC' }); // count = 2
      machine.send({ type: 'INC' }); // count = 3
      machine.send({ type: 'INC' }); // count = 4

      expect(machine.getContext().count).toBe(4);

      machine.rewind(3); // Back to count = 1
      expect(machine.getContext().count).toBe(1);
      expect(machine.getHistoryIndex()).toBe(1);
    });

    it('should rewind all the way to initial state', () => {
      type Context = { count: number };
      type Event = { type: 'INC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'active',
        timeTravel: true,
        states: {
          active: {
            on: { INC: { assign: 'increment' } },
          },
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine = new StateMachine(config).start();

      machine.send({ type: 'INC' });
      machine.send({ type: 'INC' });
      machine.send({ type: 'INC' });

      machine.rewind(100); // Rewind more than history length
      expect(machine.getContext().count).toBe(0);
      expect(machine.getHistoryIndex()).toBe(0);
      expect(machine.getActiveStateNodes()).toEqual(new Set(['active']));
    });

    it('should not rewind beyond beginning', () => {
      type Context = { count: number };
      type Event = { type: 'INC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'active',
        timeTravel: true,
        states: {
          active: {
            on: { INC: { assign: 'increment' } },
          },
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'INC' });

      machine.rewind(100);
      expect(machine.getHistoryIndex()).toBe(0);

      // Rewind again at beginning - should stay at 0
      machine.rewind();
      expect(machine.getHistoryIndex()).toBe(0);
    });
  });

  describe('Basic Fast-Forward', () => {
    it('should fast-forward one step', () => {
      type Context = { count: number };
      type Event = { type: 'INC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'active',
        timeTravel: true,
        states: {
          active: {
            on: { INC: { assign: 'increment' } },
          },
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine = new StateMachine(config).start();

      machine.send({ type: 'INC' }); // count = 1
      machine.send({ type: 'INC' }); // count = 2

      machine.rewind(2); // Back to count = 0
      expect(machine.getContext().count).toBe(0);

      machine.ff(); // Forward to count = 1
      expect(machine.getContext().count).toBe(1);
      expect(machine.getHistoryIndex()).toBe(1);
    });

    it('should fast-forward multiple steps', () => {
      type Context = { count: number };
      type Event = { type: 'INC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'active',
        timeTravel: true,
        states: {
          active: {
            on: { INC: { assign: 'increment' } },
          },
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine = new StateMachine(config).start();

      machine.send({ type: 'INC' });
      machine.send({ type: 'INC' });
      machine.send({ type: 'INC' });
      machine.send({ type: 'INC' }); // count = 4

      machine.rewind(4); // Back to 0
      expect(machine.getContext().count).toBe(0);

      machine.ff(3); // Forward to 3
      expect(machine.getContext().count).toBe(3);
      expect(machine.getHistoryIndex()).toBe(3);
    });

    it('should not fast-forward beyond end', () => {
      type Context = { count: number };
      type Event = { type: 'INC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'active',
        timeTravel: true,
        states: {
          active: {
            on: { INC: { assign: 'increment' } },
          },
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine = new StateMachine(config).start();

      machine.send({ type: 'INC' });
      machine.send({ type: 'INC' }); // count = 2, index = 2

      machine.rewind(1); // index = 1

      machine.ff(100); // Try to go way forward
      expect(machine.getHistoryIndex()).toBe(2); // Should stop at end
      expect(machine.getContext().count).toBe(2);

      // FF again at end - should stay at end
      machine.ff();
      expect(machine.getHistoryIndex()).toBe(2);
    });
  });

  describe('State Configuration Tracking', () => {
    it('should restore state configuration after rewind', () => {
      type Context = Record<string, never>;
      type Event = { type: 'NEXT' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'a',
        timeTravel: true,
        states: {
          a: { on: { NEXT: { target: 'b' } } },
          b: { on: { NEXT: { target: 'c' } } },
          c: {},
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getActiveStateNodes()).toEqual(new Set(['a']));

      machine.send({ type: 'NEXT' }); // a -> b
      expect(machine.getActiveStateNodes()).toEqual(new Set(['b']));

      machine.send({ type: 'NEXT' }); // b -> c
      expect(machine.getActiveStateNodes()).toEqual(new Set(['c']));

      machine.rewind(2); // Back to a
      expect(machine.getActiveStateNodes()).toEqual(new Set(['a']));

      machine.ff(); // Forward to b
      expect(machine.getActiveStateNodes()).toEqual(new Set(['b']));
    });

    it('should restore nested state configuration', () => {
      type Context = Record<string, never>;
      type Event = { type: 'NEXT' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'parent',
        timeTravel: true,
        states: {
          parent: {
            initial: 'child1',
            states: {
              child1: { on: { NEXT: { target: 'child2' } } },
              child2: {},
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      expect(machine.getActiveStateNodes()).toEqual(new Set(['parent', 'parent.child1']));

      machine.send({ type: 'NEXT' });
      expect(machine.getActiveStateNodes()).toEqual(new Set(['parent', 'parent.child2']));

      machine.rewind();
      expect(machine.getActiveStateNodes()).toEqual(new Set(['parent', 'parent.child1']));
    });
  });

  describe('State Entry Counters', () => {
    it('should restore state entry counters after rewind', () => {
      type Context = Record<string, never>;
      type Event = { type: 'TOGGLE' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'a',
        timeTravel: true,
        states: {
          a: {
            activities: ['activityA'],
            on: { TOGGLE: { target: 'b' } },
          },
          b: {
            activities: ['activityB'],
            on: { TOGGLE: { target: 'a' } },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // Initial: a=1, b=0
      expect(machine.getStateCounters()['a']).toBe(1);
      expect(machine.getStateCounters()['b']).toBeUndefined();

      machine.send({ type: 'TOGGLE' }); // a -> b
      // Now: a=1, b=1
      expect(machine.getStateCounters()['a']).toBe(1);
      expect(machine.getStateCounters()['b']).toBe(1);

      machine.send({ type: 'TOGGLE' }); // b -> a
      // Now: a=2, b=1
      expect(machine.getStateCounters()['a']).toBe(2);
      expect(machine.getStateCounters()['b']).toBe(1);

      machine.send({ type: 'TOGGLE' }); // a -> b
      // Now: a=2, b=2
      expect(machine.getStateCounters()['a']).toBe(2);
      expect(machine.getStateCounters()['b']).toBe(2);

      // Rewind to state where a=1, b=1
      machine.rewind(2);
      expect(machine.getStateCounters()['a']).toBe(1);
      expect(machine.getStateCounters()['b']).toBe(1);

      // Rewind to initial state where a=1, b=undefined
      machine.rewind();
      expect(machine.getStateCounters()['a']).toBe(1);
      expect(machine.getStateCounters()['b']).toBeUndefined();
    });
  });

  describe('History Branching', () => {
    it('should create new branch when sending after rewind', () => {
      type Context = { value: string };
      type Event = { type: 'A' } | { type: 'B' } | { type: 'C' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { value: 'start' },
        initial: 'active',
        timeTravel: true,
        states: {
          active: {
            on: {
              A: { assign: 'setA' },
              B: { assign: 'setB' },
              C: { assign: 'setC' },
            },
          },
        },
        reducers: {
          setA: () => ({ value: 'A' }),
          setB: () => ({ value: 'B' }),
          setC: () => ({ value: 'C' }),
        },
      };

      const machine = new StateMachine(config).start();
      // History: ['start']

      machine.send({ type: 'A' });
      // History: ['start', 'A']

      machine.send({ type: 'B' });
      // History: ['start', 'A', 'B']

      expect(machine.getHistoryLength()).toBe(3);
      expect(machine.getContext().value).toBe('B');

      // Rewind one step
      machine.rewind();
      expect(machine.getContext().value).toBe('A');
      expect(machine.getHistoryIndex()).toBe(1);
      expect(machine.getHistoryLength()).toBe(3); // History still has 3 items

      // Send a new event - this should branch history
      machine.send({ type: 'C' });
      // History should now be: ['start', 'A', 'C'] (B was removed)

      expect(machine.getContext().value).toBe('C');
      expect(machine.getHistoryIndex()).toBe(2);
      expect(machine.getHistoryLength()).toBe(3); // Same length but different content

      // Try to fast-forward - should be at the end already
      machine.ff();
      expect(machine.getContext().value).toBe('C');
      expect(machine.getHistoryIndex()).toBe(2);
    });

    it('should handle multiple branches correctly', () => {
      type Context = { path: string[] };
      type Event = { type: 'ADD'; value: string };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { path: [] },
        initial: 'active',
        timeTravel: true,
        states: {
          active: {
            on: {
              ADD: { assign: 'addToPath' },
            },
          },
        },
        reducers: {
          addToPath: ({ context, event }) => ({ path: [...context.path, event.value] }),
        },
      };

      const machine = new StateMachine(config).start();

      machine.send({ type: 'ADD', value: 'A' });
      machine.send({ type: 'ADD', value: 'B' });
      machine.send({ type: 'ADD', value: 'C' });
      // Path: [] -> [A] -> [A,B] -> [A,B,C]

      expect(machine.getContext().path).toEqual(['A', 'B', 'C']);

      // Rewind to [A]
      machine.rewind(2);
      expect(machine.getContext().path).toEqual(['A']);

      // Branch with X
      machine.send({ type: 'ADD', value: 'X' });
      expect(machine.getContext().path).toEqual(['A', 'X']);
      expect(machine.getHistoryLength()).toBe(3); // [], [A], [A,X]

      // Can't FF to the old B,C path anymore
      machine.ff(100);
      expect(machine.getContext().path).toEqual(['A', 'X']);
    });

    it('should truncate history at branch point', () => {
      type Context = { count: number };
      type Event = { type: 'INC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'active',
        timeTravel: true,
        states: {
          active: {
            on: { INC: { assign: 'increment' } },
          },
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine = new StateMachine(config).start();

      // Build history: 0, 1, 2, 3, 4
      for (let i = 0; i < 4; i++) {
        machine.send({ type: 'INC' });
      }

      expect(machine.getHistoryLength()).toBe(5); // 0,1,2,3,4

      // Rewind to 1
      machine.rewind(3);
      expect(machine.getContext().count).toBe(1);
      expect(machine.getHistoryLength()).toBe(5); // Still has future

      // Send event to branch
      machine.send({ type: 'INC' }); // count becomes 2 again
      expect(machine.getHistoryLength()).toBe(3); // 0,1,2 (3,4 removed)
      expect(machine.getContext().count).toBe(2);

      // Try to FF beyond new end
      machine.ff(100);
      expect(machine.getHistoryIndex()).toBe(2);
      expect(machine.getContext().count).toBe(2);
    });
  });

  describe('Complex Scenarios', () => {
    it('should work with state transitions and context changes', () => {
      type Context = { count: number };
      type Event = { type: 'NEXT' } | { type: 'INC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'a',
        timeTravel: true,
        states: {
          a: {
            on: {
              NEXT: { target: 'b' },
              INC: { assign: 'increment' },
            },
          },
          b: {
            on: {
              NEXT: { target: 'a' },
              INC: { assign: 'increment' },
            },
          },
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine = new StateMachine(config).start();

      machine.send({ type: 'INC' }); // count = 1, state = a
      machine.send({ type: 'NEXT' }); // count = 1, state = b
      machine.send({ type: 'INC' }); // count = 2, state = b
      machine.send({ type: 'INC' }); // count = 3, state = b

      expect(machine.getContext().count).toBe(3);
      expect(machine.getActiveStateNodes()).toEqual(new Set(['b']));

      machine.rewind(2); // Back to count = 1, state = b
      expect(machine.getContext().count).toBe(1);
      expect(machine.getActiveStateNodes()).toEqual(new Set(['b']));

      machine.rewind(); // Back to count = 1, state = a
      expect(machine.getContext().count).toBe(1);
      expect(machine.getActiveStateNodes()).toEqual(new Set(['a']));
    });

    it('should handle always transitions in history', () => {
      type Context = { value: number };
      type Event = { type: 'SET'; value: number };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { value: 0 },
        initial: 'input',
        timeTravel: true,
        states: {
          input: {
            on: { SET: { assign: 'setValue', target: 'checking' } },
          },
          checking: {
            always: [
              { target: 'high', guard: 'isHigh' },
              { target: 'low', guard: 'isLow' },
              { target: 'medium' },
            ],
          },
          low: {
            on: { SET: { assign: 'setValue', target: 'checking' } },
          },
          medium: {
            on: { SET: { assign: 'setValue', target: 'checking' } },
          },
          high: {
            on: { SET: { assign: 'setValue', target: 'checking' } },
          },
        },
        guards: {
          isHigh: ({ context }) => context.value > 75,
          isLow: ({ context }) => context.value < 25,
        },
        reducers: {
          setValue: ({ event }) => ({ value: event.value }),
        },
      };

      const machine = new StateMachine(config).start();

      machine.send({ type: 'SET', value: 10 }); // -> checking -> low
      expect(machine.getActiveStateNodes()).toEqual(new Set(['low']));

      machine.send({ type: 'SET', value: 90 }); // -> checking -> high
      expect(machine.getActiveStateNodes()).toEqual(new Set(['high']));

      machine.rewind(); // Back to low
      expect(machine.getActiveStateNodes()).toEqual(new Set(['low']));
      expect(machine.getContext().value).toBe(10);

      machine.ff(); // Forward to high
      expect(machine.getActiveStateNodes()).toEqual(new Set(['high']));
      expect(machine.getContext().value).toBe(90);
    });

    it('should restore halted state correctly', () => {
      type Context = Record<string, never>;
      type Event = { type: 'FINISH' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'running',
        timeTravel: true,
        states: {
          running: {
            on: { FINISH: { target: 'done' } },
          },
          done: {
            type: 'final',
          },
        },
      };

      const machine = new StateMachine(config).start();

      expect(machine.isHalted()).toBe(false);

      machine.send({ type: 'FINISH' });
      expect(machine.isHalted()).toBe(true);
      expect(machine.getActiveStateNodes()).toEqual(new Set(['done']));

      machine.rewind(); // Back to running
      expect(machine.isHalted()).toBe(false);
      expect(machine.getActiveStateNodes()).toEqual(new Set(['running']));

      machine.ff(); // Forward to done
      expect(machine.isHalted()).toBe(true);
      expect(machine.getActiveStateNodes()).toEqual(new Set(['done']));
    });

    it('should work with parallel states', () => {
      type Context = Record<string, never>;
      type Event = { type: 'TOGGLE_A' } | { type: 'TOGGLE_B' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'parallel',
        timeTravel: true,
        states: {
          parallel: {
            type: 'parallel',
            states: {
              regionA: {
                initial: 'a1',
                states: {
                  a1: { on: { TOGGLE_A: { target: 'a2' } } },
                  a2: { on: { TOGGLE_A: { target: 'a1' } } },
                },
              },
              regionB: {
                initial: 'b1',
                states: {
                  b1: { on: { TOGGLE_B: { target: 'b2' } } },
                  b2: { on: { TOGGLE_B: { target: 'b1' } } },
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();

      const initialConfig = machine.getActiveStateNodes();
      expect(initialConfig).toEqual(
        new Set([
          'parallel',
          'parallel.regionA',
          'parallel.regionA.a1',
          'parallel.regionB',
          'parallel.regionB.b1',
        ])
      );

      machine.send({ type: 'TOGGLE_A' }); // a1 -> a2
      machine.send({ type: 'TOGGLE_B' }); // b1 -> b2

      expect(machine.getActiveStateNodes()).toEqual(
        new Set([
          'parallel',
          'parallel.regionA',
          'parallel.regionA.a2',
          'parallel.regionB',
          'parallel.regionB.b2',
        ])
      );

      machine.rewind(2); // Back to initial
      expect(machine.getActiveStateNodes()).toEqual(initialConfig);

      machine.ff(); // Forward one
      expect(machine.getActiveStateNodes()).toEqual(
        new Set([
          'parallel',
          'parallel.regionA',
          'parallel.regionA.a2',
          'parallel.regionB',
          'parallel.regionB.b1',
        ])
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle rewind at initial state', () => {
      type Context = Record<string, never>;
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'a',
        timeTravel: true,
        states: {
          a: {},
        },
      };

      const machine = new StateMachine(config).start();

      expect(machine.getHistoryIndex()).toBe(0);
      expect(machine.getHistoryLength()).toBe(1);

      machine.rewind(); // Should not fail
      expect(machine.getHistoryIndex()).toBe(0);
    });

    it('should handle ff at end of history', () => {
      type Context = { count: number };
      type Event = { type: 'INC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'active',
        timeTravel: true,
        states: {
          active: {
            on: { INC: { assign: 'increment' } },
          },
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'INC' });

      const endIndex = machine.getHistoryIndex();

      machine.ff(); // Should not fail
      expect(machine.getHistoryIndex()).toBe(endIndex);
    });

    it('should maintain history through multiple rewind/ff cycles', () => {
      type Context = { count: number };
      type Event = { type: 'INC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'active',
        timeTravel: true,
        states: {
          active: {
            on: { INC: { assign: 'increment' } },
          },
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine = new StateMachine(config).start();

      for (let i = 0; i < 5; i++) {
        machine.send({ type: 'INC' });
      }

      expect(machine.getContext().count).toBe(5);

      // Rewind and ff multiple times
      machine.rewind(3); // count = 2
      expect(machine.getContext().count).toBe(2);

      machine.ff(2); // count = 4
      expect(machine.getContext().count).toBe(4);

      machine.rewind(); // count = 3
      expect(machine.getContext().count).toBe(3);

      machine.ff(); // count = 4
      expect(machine.getContext().count).toBe(4);

      machine.rewind(4); // count = 0
      expect(machine.getContext().count).toBe(0);

      machine.ff(5); // count = 5
      expect(machine.getContext().count).toBe(5);
    });
  });
});
