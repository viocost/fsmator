import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig, MachineSnapshot } from '../src/types';

describe('Hydrate', () => {
  describe('Basic hydration', () => {
    it('should hydrate guards and assigns after loading snapshot', () => {
      type Context = { count: number };
      type Event = { type: 'INCREMENT' } | { type: 'NEXT' };

      // Config without implementations (like from external library)
      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            on: {
              INCREMENT: { assign: 'increment' },
              NEXT: { target: 'active', guard: 'isPositive' },
            },
          },
          active: {},
        },
      };

      // Create snapshot from a machine with implementations
      const machine1 = new StateMachine({
        ...config,
        guards: {
          isPositive: ({ context }) => context.count > 0,
        },
        assigns: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      }).start();

      machine1.handle({ type: 'INCREMENT' });
      machine1.handle({ type: 'INCREMENT' });
      const snapshot = machine1.getSnapshot();

      // Create new machine, load snapshot, then hydrate with implementations
      const machine2 = new StateMachine(config)
        .load(snapshot)
        .hydrate({
          guards: {
            isPositive: ({ context }) => context.count > 0,
          },
          assigns: {
            increment: ({ context }) => ({ count: context.count + 1 }),
          },
        })
        .start();

      expect(machine2.getContext()).toEqual({ count: 2 });
      expect(machine2.getActiveStateNodes()).toEqual(new Set(['idle']));

      // Verify guard works
      machine2.handle({ type: 'NEXT' });
      expect(machine2.getActiveStateNodes()).toEqual(new Set(['active']));
    });

    it('should allow hydrating only guards', () => {
      type Context = { count: number };
      type Event = { type: 'NEXT' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 5 },
        initial: 'idle',
        states: {
          idle: {
            on: {
              NEXT: { target: 'active', guard: 'isPositive' },
            },
          },
          active: {},
        },
      };

      const snapshot: MachineSnapshot<Context> = {
        context: { count: 5 },
        configuration: ['idle'],
        stateCounters: { idle: 1 },
      };

      const machine = new StateMachine(config)
        .load(snapshot)
        .hydrate({
          guards: {
            isPositive: ({ context }) => context.count > 0,
          },
        })
        .start();

      machine.handle({ type: 'NEXT' });
      expect(machine.getActiveStateNodes()).toEqual(new Set(['active']));
    });

    it('should allow hydrating only assigns', () => {
      type Context = { count: number };
      type Event = { type: 'INCREMENT' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            on: {
              INCREMENT: { assign: 'increment' },
            },
          },
        },
      };

      const snapshot: MachineSnapshot<Context> = {
        context: { count: 5 },
        configuration: ['idle'],
        stateCounters: { idle: 1 },
      };

      const machine = new StateMachine(config)
        .load(snapshot)
        .hydrate({
          assigns: {
            increment: ({ context }) => ({ count: context.count + 1 }),
          },
        })
        .start();

      machine.handle({ type: 'INCREMENT' });
      expect(machine.getContext()).toEqual({ count: 6 });
    });
  });

  describe('Chaining', () => {
    it('should support load().hydrate().start() chaining', () => {
      type Context = { value: string };
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { value: 'initial' },
        initial: 'a',
        states: {
          a: {
            on: { GO: { target: 'b', guard: 'canGo' } },
          },
          b: {},
        },
      };

      const snapshot: MachineSnapshot<Context> = {
        context: { value: 'loaded' },
        configuration: ['a'],
        stateCounters: { a: 1 },
      };

      const machine = new StateMachine(config)
        .load(snapshot)
        .hydrate({
          guards: {
            canGo: () => true,
          },
        })
        .start();

      expect(machine.getContext()).toEqual({ value: 'loaded' });
      machine.handle({ type: 'GO' });
      expect(machine.getActiveStateNodes()).toEqual(new Set(['b']));
    });

    it('should allow hydrate before load', () => {
      type Context = { count: number };
      type Event = { type: 'INCREMENT' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            on: { INCREMENT: { assign: 'increment' } },
          },
        },
      };

      const snapshot: MachineSnapshot<Context> = {
        context: { count: 10 },
        configuration: ['idle'],
        stateCounters: { idle: 1 },
      };

      const machine = new StateMachine(config)
        .hydrate({
          assigns: {
            increment: ({ context }) => ({ count: context.count + 1 }),
          },
        })
        .load(snapshot)
        .start();

      expect(machine.getContext()).toEqual({ count: 10 });
      machine.handle({ type: 'INCREMENT' });
      expect(machine.getContext()).toEqual({ count: 11 });
    });
  });

  describe('Merging with existing implementations', () => {
    it('should merge hydrated implementations with config implementations', () => {
      type Context = { count: number };
      type Event = { type: 'INC' } | { type: 'DEC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 5 },
        initial: 'idle',
        assigns: {
          // Existing implementation in config
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
        states: {
          idle: {
            on: {
              INC: { assign: 'increment' },
              DEC: { assign: 'decrement' }, // Will be hydrated
            },
          },
        },
      };

      const snapshot: MachineSnapshot<Context> = {
        context: { count: 5 },
        configuration: ['idle'],
        stateCounters: { idle: 1 },
      };

      const machine = new StateMachine(config)
        .load(snapshot)
        .hydrate({
          assigns: {
            // Add missing implementation
            decrement: ({ context }) => ({ count: context.count - 1 }),
          },
        })
        .start();

      machine.handle({ type: 'INC' });
      expect(machine.getContext()).toEqual({ count: 6 });

      machine.handle({ type: 'DEC' });
      expect(machine.getContext()).toEqual({ count: 5 });
    });

    it('should allow overriding existing implementations', () => {
      type Context = { count: number };
      type Event = { type: 'INCREMENT' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'idle',
        assigns: {
          increment: ({ context }) => ({ count: context.count + 1 }), // +1
        },
        states: {
          idle: {
            on: { INCREMENT: { assign: 'increment' } },
          },
        },
      };

      const snapshot: MachineSnapshot<Context> = {
        context: { count: 10 },
        configuration: ['idle'],
        stateCounters: { idle: 1 },
      };

      const machine = new StateMachine(config)
        .load(snapshot)
        .hydrate({
          assigns: {
            increment: ({ context }) => ({ count: context.count + 10 }), // Override to +10
          },
        })
        .start();

      machine.handle({ type: 'INCREMENT' });
      expect(machine.getContext()).toEqual({ count: 20 }); // Should use hydrated version
    });
  });

  describe('Error handling', () => {
    it('should throw error if hydrate called after start', () => {
      type Context = Record<string, never>;
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'idle',
        states: {
          idle: {},
        },
      };

      const machine = new StateMachine(config).start();

      expect(() =>
        machine.hydrate({
          guards: {
            test: () => true,
          },
        })
      ).toThrow('Cannot hydrate already started machine');
    });

    it('should validate implementations on start after hydrate', () => {
      type Context = Record<string, never>;
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'idle',
        states: {
          idle: {
            on: {
              GO: { target: 'active', guard: 'missingGuard' },
            },
          },
          active: {},
        },
      };

      const snapshot: MachineSnapshot<Context> = {
        context: {},
        configuration: ['idle'],
        stateCounters: { idle: 1 },
      };

      const machine = new StateMachine(config).load(snapshot).hydrate({
        assigns: {
          someAssign: () => ({}),
        },
      });

      // Should still fail validation because 'missingGuard' is not provided
      expect(() => machine.start()).toThrow('Missing guard implementation(s): missingGuard');
    });
  });

  describe('Complex scenarios', () => {
    it('should work with nested states and compound guards', () => {
      type Context = { count: number; enabled: boolean };
      type Event = { type: 'NEXT' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 5, enabled: true },
        initial: 'parent',
        states: {
          parent: {
            initial: 'child1',
            states: {
              child1: {
                on: {
                  NEXT: {
                    target: 'child2',
                    guard: { type: 'and', items: ['isPositive', 'isEnabled'] },
                  },
                },
              },
              child2: {},
            },
          },
        },
      };

      const snapshot: MachineSnapshot<Context> = {
        context: { count: 5, enabled: true },
        configuration: ['parent', 'parent.child1'],
        stateCounters: { parent: 1, 'parent.child1': 1 },
      };

      const machine = new StateMachine(config)
        .load(snapshot)
        .hydrate({
          guards: {
            isPositive: ({ context }) => context.count > 0,
            isEnabled: ({ context }) => context.enabled,
          },
        })
        .start();

      machine.handle({ type: 'NEXT' });
      expect(machine.getActiveStateNodes()).toEqual(new Set(['parent', 'parent.child2']));
    });

    it('should work with entry/exit actions', () => {
      type Context = { log: string[] };
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { log: [] },
        initial: 'a',
        states: {
          a: {
            onExit: ['logExitA'],
            on: { GO: 'b' },
          },
          b: {
            onEntry: ['logEntryB'],
          },
        },
      };

      const snapshot: MachineSnapshot<Context> = {
        context: { log: ['initial'] },
        configuration: ['a'],
        stateCounters: { a: 1 },
      };

      const machine = new StateMachine(config)
        .load(snapshot)
        .hydrate({
          assigns: {
            logExitA: ({ context }) => ({ log: [...context.log, 'exit-a'] }),
            logEntryB: ({ context }) => ({ log: [...context.log, 'entry-b'] }),
          },
        })
        .start();

      machine.handle({ type: 'GO' });
      expect(machine.getContext().log).toEqual(['initial', 'exit-a', 'entry-b']);
    });
  });
});
