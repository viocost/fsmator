import { describe, it, expect } from 'vitest';
import { StateMachine } from './state-machine';
import type { StateMachineConfig, MachineSnapshot } from './types';

describe('Snapshot Dump and Load', () => {
  describe('Basic Dump/Load', () => {
    it('should dump and load a simple machine', () => {
      type Context = { count: number };
      type Event = { type: 'INCREMENT' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'active',
        states: {
          active: {
            on: {
              INCREMENT: {
                assign: 'incrementCount',
              },
            },
          },
        },
        reducers: {
          incrementCount: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      // Create and start machine
      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'INCREMENT' });
      machine1.send({ type: 'INCREMENT' });

      // Dump state
      const json = machine1.dump();
      const snapshot = JSON.parse(json);

      // Create new machine and load
      const machine2 = new StateMachine(config).load(snapshot);

      // Verify state matches
      expect(machine2.getContext()).toEqual({ count: 2 });
      expect(machine2.getConfiguration()).toEqual(new Set(['active']));
    });

    it('should preserve context after dump/load', () => {
      type Context = { name: string; age: number; tags: string[] };
      type Event = { type: 'UPDATE'; name: string };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { name: 'Alice', age: 30, tags: ['developer'] },
        initial: 'idle',
        states: {
          idle: {},
        },
      };

      const machine1 = new StateMachine(config).start();
      const json = machine1.dump();

      const machine2 = new StateMachine(config).load(JSON.parse(json)).start();

      expect(machine2.getContext()).toEqual({
        name: 'Alice',
        age: 30,
        tags: ['developer'],
      });
    });

    it('should preserve configuration after dump/load', () => {
      type Context = Record<string, never>;
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'a',
        states: {
          a: {
            on: { GO: { target: 'b' } },
          },
          b: {},
        },
      };

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'GO' });

      const json = machine1.dump();
      const machine2 = new StateMachine(config).load(JSON.parse(json)).start();

      expect(machine2.getConfiguration()).toEqual(new Set(['b']));
    });

    it('should preserve state entry counters after dump/load', () => {
      type Context = Record<string, never>;
      type Event = { type: 'TOGGLE' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'off',
        states: {
          off: {
            on: { TOGGLE: { target: 'on' } },
          },
          on: {
            on: { TOGGLE: { target: 'off' } },
          },
        },
      };

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'TOGGLE' }); // off -> on (on:1)
      machine1.send({ type: 'TOGGLE' }); // on -> off (off:2)
      machine1.send({ type: 'TOGGLE' }); // off -> on (on:2)

      const json = machine1.dump();
      const machine2 = new StateMachine(config).load(JSON.parse(json)).start();

      // Check state counters are preserved
      const counters1 = machine1.getStateCounters();
      const counters2 = machine2.getStateCounters();

      expect(counters2).toEqual(counters1);
      expect(counters2['off']).toBe(2);
      expect(counters2['on']).toBe(2);
    });

    it('should allow sending events after load', () => {
      type Context = { value: number };
      type Event = { type: 'ADD'; amount: number };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { value: 10 },
        initial: 'running',
        states: {
          running: {
            on: {
              ADD: {
                assign: 'addValue',
              },
            },
          },
        },
        reducers: {
          addValue: ({ context, event }) => ({ value: context.value + event.amount }),
        },
      };

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'ADD', amount: 5 });

      const json = machine1.dump();
      const machine2 = new StateMachine(config).load(JSON.parse(json)).start();

      // Send event after load
      machine2.send({ type: 'ADD', amount: 3 });

      expect(machine2.getContext().value).toBe(18); // 10 + 5 + 3
    });
  });

  describe('Validation and Error Handling', () => {
    it('should throw when loading snapshot with invalid state ID', () => {
      type Context = Record<string, never>;
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'valid',
        states: {
          valid: {},
        },
      };

      const invalidSnapshot: MachineSnapshot<Context> = {
        initialContext: {},
        configuration: ['invalid_state'],
        stateEntryCounters: {},
      };

      const machine = new StateMachine(config);

      expect(() => machine.load(invalidSnapshot)).toThrow('invalid_state');
    });

    it('should throw when loading snapshot with empty configuration', () => {
      type Context = Record<string, never>;
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'valid',
        states: {
          valid: {},
        },
      };

      const invalidSnapshot: MachineSnapshot<Context> = {
        initialContext: {},
        configuration: [],
        stateEntryCounters: {},
      };

      const machine = new StateMachine(config);

      expect(() => machine.load(invalidSnapshot)).toThrow('empty');
    });

    it('should throw when loading snapshot with invalid state counter', () => {
      type Context = Record<string, never>;
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'valid',
        states: {
          valid: {},
        },
      };

      const invalidSnapshot: MachineSnapshot<Context> = {
        context: {},
        configuration: ['valid'],
        stateCounters: { invalid_state: 1 },
      };

      const machine = new StateMachine(config);

      expect(() => machine.load(invalidSnapshot)).toThrow('invalid_state');
    });

    it('should throw when calling load on already started machine', () => {
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
      const snapshot: MachineSnapshot<Context> = {
        context: {},
        configuration: ['idle'],
        stateCounters: {},
      };

      expect(() => machine.load(snapshot)).toThrow('already started');
    });

    it('should throw when calling dump on non-started machine', () => {
      type Context = Record<string, never>;
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'idle',
        states: {
          idle: {},
        },
      };

      const machine = new StateMachine(config);

      expect(() => machine.dump()).toThrow('not started');
    });

    it('should throw when calling start on already started machine', () => {
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

      expect(() => machine.start()).toThrow('already started');
    });
  });

  describe('Complex State Machines', () => {
    it('should dump/load nested state machines', () => {
      type Context = { level: number };
      type Event = { type: 'NEXT' } | { type: 'BACK' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { level: 0 },
        initial: 'menu',
        states: {
          menu: {
            initial: 'main',
            states: {
              main: {
                on: { NEXT: { target: 'settings' } },
              },
              settings: {
                initial: 'general',
                states: {
                  general: {
                    on: { NEXT: { target: 'advanced' } },
                  },
                  advanced: {},
                },
              },
            },
          },
        },
      };

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'NEXT' }); // main -> settings
      machine1.send({ type: 'NEXT' }); // general -> advanced

      const json = machine1.dump();
      const machine2 = new StateMachine(config).load(JSON.parse(json)).start();

      expect(machine2.getConfiguration()).toEqual(
        new Set(['menu', 'menu.settings', 'menu.settings.advanced'])
      );
    });

    it('should dump/load parallel state machines', () => {
      type Context = Record<string, never>;
      type Event = { type: 'TOGGLE_BOLD' } | { type: 'TOGGLE_ITALIC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'editor',
        states: {
          editor: {
            type: 'parallel',
            states: {
              bold: {
                initial: 'off',
                states: {
                  off: {
                    on: { TOGGLE_BOLD: { target: 'on' } },
                  },
                  on: {
                    on: { TOGGLE_BOLD: { target: 'off' } },
                  },
                },
              },
              italic: {
                initial: 'off',
                states: {
                  off: {
                    on: { TOGGLE_ITALIC: { target: 'on' } },
                  },
                  on: {
                    on: { TOGGLE_ITALIC: { target: 'off' } },
                  },
                },
              },
            },
          },
        },
      };

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'TOGGLE_BOLD' });
      machine1.send({ type: 'TOGGLE_ITALIC' });

      const json = machine1.dump();
      const machine2 = new StateMachine(config).load(JSON.parse(json)).start();

      expect(machine2.getConfiguration()).toEqual(
        new Set(['editor', 'editor.bold', 'editor.bold.on', 'editor.italic', 'editor.italic.on'])
      );
    });

    it('should dump/load with activities active', () => {
      type Context = Record<string, never>;
      type Event = { type: 'START' } | { type: 'STOP' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'idle',
        states: {
          idle: {
            on: { START: { target: 'active' } },
          },
          active: {
            activities: ['monitoring'],
            on: { STOP: { target: 'idle' } },
          },
        },
      };

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'START' });

      // Check state counters before dump
      const counters1 = machine1.getStateCounters();
      expect(counters1['active']).toBe(1);

      const json = machine1.dump();
      const machine2 = new StateMachine(config).load(JSON.parse(json)).start();

      // Check state counters after load - should be preserved
      const counters2 = machine2.getStateCounters();
      expect(counters2['active']).toBe(1);
      expect(machine2.getConfiguration()).toEqual(new Set(['active']));

      // Restart activity to check counter increments
      machine2.send({ type: 'STOP' });
      machine2.send({ type: 'START' });
      expect(machine2.getStateCounters()['active']).toBe(2);
    });

    it('should handle always transitions after load', () => {
      type Context = { value: number };
      type Event = { type: 'SET'; value: number };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { value: 0 },
        initial: 'checking',
        states: {
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

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'SET', value: 80 });

      const json = machine1.dump();
      const machine2 = new StateMachine(config).load(JSON.parse(json)).start();

      expect(machine2.getConfiguration()).toEqual(new Set(['high']));

      // Send event after load - should trigger always transitions
      machine2.send({ type: 'SET', value: 10 });
      expect(machine2.getConfiguration()).toEqual(new Set(['low']));
    });

    it('should handle multiple dump/load cycles', () => {
      type Context = { step: number };
      type Event = { type: 'NEXT' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { step: 0 },
        initial: 'active',
        states: {
          active: {
            on: {
              NEXT: {
                assign: 'incrementStep',
              },
            },
          },
        },
        reducers: {
          incrementStep: ({ context }) => ({ step: context.step + 1 }),
        },
      };

      // First cycle
      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'NEXT' });
      const json1 = machine1.dump();

      // Second cycle
      const machine2 = new StateMachine(config).load(JSON.parse(json1)).start();
      machine2.send({ type: 'NEXT' });
      const json2 = machine2.dump();

      // Third cycle
      const machine3 = new StateMachine(config).load(JSON.parse(json2)).start();
      machine3.send({ type: 'NEXT' });

      expect(machine3.getContext().step).toBe(3);
    });
  });

  describe('JSON Serialization', () => {
    it('should produce valid JSON from dump()', () => {
      type Context = { data: string };
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { data: 'test' },
        initial: 'idle',
        states: {
          idle: {},
        },
      };

      const machine = new StateMachine(config).start();
      const json = machine.dump();

      // Should not throw
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty('context');
      expect(parsed).toHaveProperty('configuration');
      expect(parsed).toHaveProperty('stateCounters');
    });

    it('should round-trip through JSON without data loss', () => {
      type Context = {
        name: string;
        count: number;
        items: string[];
        metadata: { key: string };
      };
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {
          name: 'test',
          count: 42,
          items: ['a', 'b', 'c'],
          metadata: { key: 'value' },
        },
        initial: 'active',
        states: {
          active: {},
        },
      };

      const machine1 = new StateMachine(config).start();
      const json = machine1.dump();
      const snapshot = JSON.parse(json);
      const machine2 = new StateMachine(config).load(snapshot);

      expect(machine2.getContext()).toEqual(machine1.getContext());
      expect(machine2.getConfiguration()).toEqual(machine1.getConfiguration());
    });

    it('should handle special characters in context', () => {
      type Context = { message: string };
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { message: 'Hello "world"\nWith\ttabs and \\backslashes' },
        initial: 'idle',
        states: {
          idle: {},
        },
      };

      const machine1 = new StateMachine(config).start();
      const json = machine1.dump();
      const machine2 = new StateMachine(config).load(JSON.parse(json)).start();

      expect(machine2.getContext().message).toBe(machine1.getContext().message);
    });
  });

  describe('Event Processing After Load', () => {
    it('should correctly transition after loading mid-execution', () => {
      type Context = { count: number };
      type Event = { type: 'INC' } | { type: 'RESET' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'counting',
        states: {
          counting: {
            on: {
              INC: { assign: 'increment' },
              RESET: { target: 'idle' },
            },
          },
          idle: {
            on: {
              INC: { target: 'counting' },
            },
          },
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'INC' });
      machine1.send({ type: 'INC' });

      const json = machine1.dump();
      const machine2 = new StateMachine(config).load(JSON.parse(json)).start();

      // Continue from where we left off
      machine2.send({ type: 'INC' });
      expect(machine2.getContext().count).toBe(3);

      machine2.send({ type: 'RESET' });
      expect(machine2.getConfiguration()).toEqual(new Set(['idle']));
    });

    it('should evaluate always transitions immediately after load', () => {
      type Context = { ready: boolean };
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { ready: true },
        initial: 'init',
        states: {
          init: {
            always: [{ target: 'ready', guard: 'isReady' }, { target: 'waiting' }],
          },
          waiting: {},
          ready: {},
        },
        guards: {
          isReady: ({ context }) => context.ready,
        },
      };

      // Create snapshot manually with init state
      const snapshot: MachineSnapshot<Context> = {
        context: { ready: true },
        configuration: ['init'],
        stateCounters: { init: 1 },
      };

      // Load and start should trigger always transition
      const machine = new StateMachine(config).load(snapshot).start();

      expect(machine.getConfiguration()).toEqual(new Set(['ready']));
    });

    it('should track state counters correctly after load', () => {
      type Context = Record<string, never>;
      type Event = { type: 'START' } | { type: 'STOP' } | { type: 'RESTART' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'idle',
        states: {
          idle: {
            on: { START: { target: 'running' } },
          },
          running: {
            activities: ['task'],
            on: {
              STOP: { target: 'idle' },
              RESTART: { target: 'running' },
            },
          },
        },
      };

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'START' });

      const json = machine1.dump();
      const machine2 = new StateMachine(config).load(JSON.parse(json)).start();

      // Restart should increment instance counter
      machine2.send({ type: 'RESTART' });

      const counters = machine2.getStateCounters();

      expect(counters['running']).toBe(2); // First entry + restart
      expect(machine2.getConfiguration()).toEqual(new Set(['running']));
    });

    it('should handle entry/exit actions correctly after load', () => {
      type Context = { log: string[] };
      type Event = { type: 'NEXT' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { log: [] },
        initial: 'a',
        states: {
          a: {
            onExit: ['logExitA'],
            on: { NEXT: { target: 'b' } },
          },
          b: {
            onEntry: ['logEntryB'],
            onExit: ['logExitB'],
            on: { NEXT: { target: 'c' } },
          },
          c: {
            onEntry: ['logEntryC'],
          },
        },
        reducers: {
          logExitA: ({ context }) => ({ log: [...context.log, 'exit-a'] }),
          logEntryB: ({ context }) => ({ log: [...context.log, 'entry-b'] }),
          logExitB: ({ context }) => ({ log: [...context.log, 'exit-b'] }),
          logEntryC: ({ context }) => ({ log: [...context.log, 'entry-c'] }),
        },
      };

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'NEXT' }); // a -> b

      // Check machine1's state before dump
      expect(machine1.getContext().log).toEqual(['exit-a', 'entry-b']);

      const json = machine1.dump();
      const machine2 = new StateMachine(config).load(JSON.parse(json)).start();

      // Check that context was loaded correctly
      expect(machine2.getContext().log).toEqual(['exit-a', 'entry-b']);

      // Send event after load
      machine2.send({ type: 'NEXT' }); // b -> c

      expect(machine2.getContext().log).toEqual(['exit-a', 'entry-b', 'exit-b', 'entry-c']);
    });

    it('should throw when sending events without calling start()', () => {
      type Context = Record<string, never>;
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'idle',
        states: {
          idle: {
            on: { GO: { target: 'active' } },
          },
          active: {},
        },
      };

      const machine = new StateMachine(config);

      expect(() => machine.send({ type: 'GO' })).toThrow('not started');
    });

    it('should throw when sending events after load but before start()', () => {
      type Context = { count: number };
      type Event = { type: 'INC' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'active',
        states: {
          active: {},
        },
      };

      const snapshot: MachineSnapshot<Context> = {
        context: { count: 5 },
        configuration: ['active'],
        stateCounters: { active: 1 },
      };

      const machine = new StateMachine(config).load(snapshot);

      expect(() => machine.send({ type: 'INC' })).toThrow('not started');
    });
  });

  describe('Final States', () => {
    it('should mark machine as halted when reaching a final state', () => {
      type Context = Record<string, never>;
      type Event = { type: 'FINISH' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'running',
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
      expect(machine.getConfiguration()).toEqual(new Set(['running']));

      machine.send({ type: 'FINISH' });

      expect(machine.isHalted()).toBe(true);
      expect(machine.getConfiguration()).toEqual(new Set(['done']));
    });

    it('should ignore events when machine is halted', () => {
      type Context = { count: number };
      type Event = { type: 'FINISH' } | { type: 'INCREMENT' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { count: 0 },
        initial: 'running',
        states: {
          running: {
            on: {
              FINISH: { target: 'done' },
              INCREMENT: { assign: 'increment' },
            },
          },
          done: {
            type: 'final',
          },
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine = new StateMachine(config).start();

      machine.send({ type: 'INCREMENT' });
      expect(machine.getContext().count).toBe(1);

      machine.send({ type: 'FINISH' });
      expect(machine.isHalted()).toBe(true);

      // These should be ignored
      machine.send({ type: 'INCREMENT' });
      machine.send({ type: 'INCREMENT' });

      expect(machine.getContext().count).toBe(1); // Still 1
      expect(machine.getConfiguration()).toEqual(new Set(['done'])); // Still in done
    });

    it('should detect final state immediately on initialization', () => {
      type Context = Record<string, never>;
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'done',
        states: {
          done: {
            type: 'final',
          },
        },
      };

      const machine = new StateMachine(config).start();

      expect(machine.isHalted()).toBe(true);
      expect(machine.getConfiguration()).toEqual(new Set(['done']));
    });

    it('should detect final state after always transition', () => {
      type Context = { complete: boolean };
      type Event = { type: 'GO' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: { complete: true },
        initial: 'checking',
        states: {
          checking: {
            always: [{ target: 'done', guard: 'isComplete' }],
          },
          done: {
            type: 'final',
          },
        },
        guards: {
          isComplete: ({ context }) => context.complete,
        },
      };

      const machine = new StateMachine(config).start();

      expect(machine.isHalted()).toBe(true);
      expect(machine.getConfiguration()).toEqual(new Set(['done']));
    });

    it('should dump and load halted state correctly', () => {
      type Context = Record<string, never>;
      type Event = { type: 'FINISH' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'running',
        states: {
          running: {
            on: { FINISH: { target: 'done' } },
          },
          done: {
            type: 'final',
          },
        },
      };

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'FINISH' });

      expect(machine1.isHalted()).toBe(true);

      const json = machine1.dump();
      const machine2 = new StateMachine(config).load(JSON.parse(json)).start();

      expect(machine2.isHalted()).toBe(true);
      expect(machine2.getConfiguration()).toEqual(new Set(['done']));

      // Should ignore events
      machine2.send({ type: 'FINISH' });
      expect(machine2.getConfiguration()).toEqual(new Set(['done']));
    });

    it('should work with nested final states', () => {
      type Context = Record<string, never>;
      type Event = { type: 'COMPLETE' };

      const config: StateMachineConfig<Context, Event> = {
        initialContext: {},
        initial: 'parent',
        states: {
          parent: {
            initial: 'child',
            states: {
              child: {
                on: { COMPLETE: { target: 'finished' } },
              },
              finished: {
                type: 'final',
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();

      expect(machine.isHalted()).toBe(false);

      machine.send({ type: 'COMPLETE' });

      expect(machine.isHalted()).toBe(true);
      expect(machine.getConfiguration()).toEqual(new Set(['parent', 'parent.finished']));
    });
  });
});
