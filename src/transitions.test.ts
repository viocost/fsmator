import { describe, it, expect } from 'vitest';
import { StateMachine } from './state-machine';
import type { StateMachineConfig, StateContext, BaseEvent } from './types';

interface TestContext extends StateContext {
  log: string[];
  count: number;
}

type TestEvents =
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'GO_TO_C' }
  | { type: 'INCREMENT' }
  | { type: 'RESET' };

describe('StateMachine Initialization', () => {
  it('should initialize with initial state active', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'idle',
      states: {
        idle: {},
        active: {},
      },
    };

    const machine = new StateMachine(config).start();
    const configuration = machine.getConfiguration();

    expect(configuration.has('idle')).toBe(true);
    expect(configuration.has('active')).toBe(false);
  });

  it('should execute onEntry actions during initialization', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'idle',
      reducers: {
        logEntry: ({ context }) => ({ log: [...context.log, 'entered-idle'] }),
        incrementCount: ({ context }) => ({ count: context.count + 1 }),
      },
      states: {
        idle: {
          onEntry: ['logEntry', 'incrementCount'],
        },
      },
    };

    const machine = new StateMachine(config).start();
    const context = machine.getContext();

    expect(context.log).toEqual(['entered-idle']);
    expect(context.count).toBe(1);
  });

  it('should initialize nested compound states', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'parent',
      reducers: {
        logParent: ({ context }) => ({ log: [...context.log, 'parent'] }),
        logChild: ({ context }) => ({ log: [...context.log, 'child'] }),
      },
      states: {
        parent: {
          initial: 'child',
          onEntry: ['logParent'],
          states: {
            child: {
              onEntry: ['logChild'],
            },
          },
        },
      },
    };

    const machine = new StateMachine(config).start();
    const configuration = machine.getConfiguration();
    const context = machine.getContext();

    expect(configuration.has('parent')).toBe(true);
    expect(configuration.has('parent.child')).toBe(true);
    expect(context.log).toEqual(['parent', 'child']);
  });

  it('should initialize parallel regions', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'parallel',
      reducers: {
        logParallel: ({ context }) => ({ log: [...context.log, 'parallel'] }),
        logRegion1: ({ context }) => ({ log: [...context.log, 'region1'] }),
        logRegion2: ({ context }) => ({ log: [...context.log, 'region2'] }),
      },
      states: {
        parallel: {
          onEntry: ['logParallel'],
          states: {
            region1: {
              initial: 'a',
              onEntry: ['logRegion1'],
              states: { a: {} },
            },
            region2: {
              initial: 'x',
              onEntry: ['logRegion2'],
              states: { x: {} },
            },
          },
        },
      },
    };

    const machine = new StateMachine(config).start();
    const configuration = machine.getConfiguration();
    const context = machine.getContext();

    expect(configuration.has('parallel')).toBe(true);
    expect(configuration.has('parallel.region1')).toBe(true);
    expect(configuration.has('parallel.region2')).toBe(true);
    expect(configuration.has('parallel.region1.a')).toBe(true);
    expect(configuration.has('parallel.region2.x')).toBe(true);
    expect(context.log).toContain('parallel');
    expect(context.log).toContain('region1');
    expect(context.log).toContain('region2');
  });
});

describe('StateMachine.send() - Simple Transitions', () => {
  it('should transition between sibling states', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'idle',
      states: {
        idle: {
          on: {
            NEXT: { target: 'active' },
          },
        },
        active: {},
      },
    };

    const machine = new StateMachine(config).start();
    expect(machine.getConfiguration().has('idle')).toBe(true);

    machine.send({ type: 'NEXT' });

    const config2 = machine.getConfiguration();
    expect(config2.has('idle')).toBe(false);
    expect(config2.has('active')).toBe(true);
  });

  it('should execute exit then entry actions during transition', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'idle',
      reducers: {
        logIdleExit: ({ context }) => ({ log: [...context.log, 'exit-idle'] }),
        logActiveEntry: ({ context }) => ({ log: [...context.log, 'enter-active'] }),
      },
      states: {
        idle: {
          onExit: ['logIdleExit'],
          on: {
            NEXT: { target: 'active' },
          },
        },
        active: {
          onEntry: ['logActiveEntry'],
        },
      },
    };

    const machine = new StateMachine(config).start();
    machine.send({ type: 'NEXT' });

    const context = machine.getContext();
    expect(context.log).toEqual(['exit-idle', 'enter-active']);
  });

  it('should execute transition assign actions', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'idle',
      reducers: {
        incrementCount: ({ context }) => ({ count: context.count + 1 }),
      },
      states: {
        idle: {
          on: {
            NEXT: { target: 'active', assign: 'incrementCount' },
          },
        },
        active: {},
      },
    };

    const machine = new StateMachine(config).start();
    machine.send({ type: 'NEXT' });

    const context = machine.getContext();
    expect(context.count).toBe(1);
  });

  it('should allow transition with guard when guard returns true', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 5 },
      initial: 'idle',
      guards: {
        isPositive: ({ context }) => context.count > 0,
      },
      states: {
        idle: {
          on: {
            NEXT: { target: 'active', guard: 'isPositive' },
          },
        },
        active: {},
      },
    };

    const machine = new StateMachine(config).start();
    machine.send({ type: 'NEXT' });

    expect(machine.getConfiguration().has('active')).toBe(true);
  });

  it('should block transition with guard when guard returns false', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'idle',
      guards: {
        isPositive: ({ context }) => context.count > 0,
      },
      states: {
        idle: {
          on: {
            NEXT: { target: 'active', guard: 'isPositive' },
          },
        },
        active: {},
      },
    };

    const machine = new StateMachine(config).start();
    machine.send({ type: 'NEXT' });

    // Should remain in idle because guard failed
    expect(machine.getConfiguration().has('idle')).toBe(true);
    expect(machine.getConfiguration().has('active')).toBe(false);
  });

  it('should handle internal transition (no target, only assign)', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'idle',
      reducers: {
        incrementCount: ({ context }) => ({ count: context.count + 1 }),
      },
      states: {
        idle: {
          on: {
            INCREMENT: { assign: 'incrementCount' },
          },
        },
      },
    };

    const machine = new StateMachine(config).start();
    machine.send({ type: 'INCREMENT' });

    // Should remain in idle
    expect(machine.getConfiguration().has('idle')).toBe(true);
    // But context should be updated
    expect(machine.getContext().count).toBe(1);
  });

  it('should handle self-transition (exit and re-enter)', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'idle',
      reducers: {
        logEntry: ({ context }) => ({ log: [...context.log, 'entry'] }),
        logExit: ({ context }) => ({ log: [...context.log, 'exit'] }),
      },
      states: {
        idle: {
          onEntry: ['logEntry'],
          onExit: ['logExit'],
          on: {
            RESET: { target: 'idle' },
          },
        },
      },
    };

    const machine = new StateMachine(config).start();
    const initialLog = machine.getContext().log;
    expect(initialLog).toEqual(['entry']);

    machine.send({ type: 'RESET' });

    const context = machine.getContext();
    expect(context.log).toEqual(['entry', 'exit', 'entry']);
  });

  it('should do nothing when event has no matching transition', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'idle',
      states: {
        idle: {},
      },
    };

    const machine = new StateMachine(config).start();
    const configBefore = new Set(machine.getConfiguration());
    const contextBefore = machine.getContext();

    machine.send({ type: 'NEXT' });

    expect(machine.getConfiguration()).toEqual(configBefore);
    expect(machine.getContext()).toBe(contextBefore);
  });
});

describe('LCA-based Transitions', () => {
  it('should transition from nested state to sibling (a.b to a.c)', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'a',
      reducers: {
        logBExit: ({ context }) => ({ log: [...context.log, 'exit-b'] }),
        logCEntry: ({ context }) => ({ log: [...context.log, 'enter-c'] }),
      },
      states: {
        a: {
          initial: 'b',
          states: {
            b: {
              onExit: ['logBExit'],
              on: {
                NEXT: { target: 'c' },
              },
            },
            c: {
              onEntry: ['logCEntry'],
            },
          },
        },
      },
    };

    const machine = new StateMachine(config).start();
    expect(machine.getConfiguration().has('a.b')).toBe(true);

    machine.send({ type: 'NEXT' });

    const configuration = machine.getConfiguration();
    expect(configuration.has('a.b')).toBe(false);
    expect(configuration.has('a.c')).toBe(true);
    expect(configuration.has('a')).toBe(true); // Parent remains active

    const context = machine.getContext();
    expect(context.log).toEqual(['exit-b', 'enter-c']);
  });

  it('should transition from deeply nested state to different branch (a.b.c to a.d.e)', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'a',
      reducers: {
        logCExit: ({ context }) => ({ log: [...context.log, 'exit-c'] }),
        logBExit: ({ context }) => ({ log: [...context.log, 'exit-b'] }),
        logDEntry: ({ context }) => ({ log: [...context.log, 'enter-d'] }),
        logEEntry: ({ context }) => ({ log: [...context.log, 'enter-e'] }),
      },
      states: {
        a: {
          initial: 'b',
          states: {
            b: {
              initial: 'c',
              onExit: ['logBExit'],
              states: {
                c: {
                  onExit: ['logCExit'],
                  on: {
                    GO_TO_C: { target: 'a.d.e' },
                  },
                },
              },
            },
            d: {
              initial: 'e',
              onEntry: ['logDEntry'],
              states: {
                e: {
                  onEntry: ['logEEntry'],
                },
              },
            },
          },
        },
      },
    };

    const machine = new StateMachine(config).start();
    expect(machine.getConfiguration().has('a.b.c')).toBe(true);

    machine.send({ type: 'GO_TO_C' });

    const configuration = machine.getConfiguration();
    expect(configuration.has('a.b')).toBe(false);
    expect(configuration.has('a.b.c')).toBe(false);
    expect(configuration.has('a.d')).toBe(true);
    expect(configuration.has('a.d.e')).toBe(true);
    expect(configuration.has('a')).toBe(true); // LCA remains active

    const context = machine.getContext();
    // Should exit c, b, then enter d, e (not exit a)
    expect(context.log).toEqual(['exit-c', 'exit-b', 'enter-d', 'enter-e']);
  });

  it('should transition from nested to top-level state', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'parent',
      reducers: {
        logParentExit: ({ context }) => ({ log: [...context.log, 'exit-parent'] }),
        logChildExit: ({ context }) => ({ log: [...context.log, 'exit-child'] }),
        logOtherEntry: ({ context }) => ({ log: [...context.log, 'enter-other'] }),
      },
      states: {
        parent: {
          initial: 'child',
          onExit: ['logParentExit'],
          states: {
            child: {
              onExit: ['logChildExit'],
              on: {
                NEXT: { target: 'other' },
              },
            },
          },
        },
        other: {
          onEntry: ['logOtherEntry'],
        },
      },
    };

    const machine = new StateMachine(config).start();
    machine.send({ type: 'NEXT' });

    const configuration = machine.getConfiguration();
    expect(configuration.has('parent')).toBe(false);
    expect(configuration.has('parent.child')).toBe(false);
    expect(configuration.has('other')).toBe(true);

    const context = machine.getContext();
    expect(context.log).toEqual(['exit-child', 'exit-parent', 'enter-other']);
  });

  it('should transition to nested state and activate its initial child', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'idle',
      reducers: {
        logParentEntry: ({ context }) => ({ log: [...context.log, 'enter-parent'] }),
        logChildEntry: ({ context }) => ({ log: [...context.log, 'enter-child'] }),
      },
      states: {
        idle: {
          on: {
            NEXT: { target: 'parent.child' },
          },
        },
        parent: {
          initial: 'child',
          onEntry: ['logParentEntry'],
          states: {
            child: {
              onEntry: ['logChildEntry'],
            },
          },
        },
      },
    };

    const machine = new StateMachine(config).start();
    machine.send({ type: 'NEXT' });

    const configuration = machine.getConfiguration();
    expect(configuration.has('idle')).toBe(false);
    expect(configuration.has('parent')).toBe(true);
    expect(configuration.has('parent.child')).toBe(true);

    const context = machine.getContext();
    expect(context.log).toEqual(['enter-parent', 'enter-child']);
  });
});

describe('Context Immutability', () => {
  it('should not mutate context in place', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'idle',
      reducers: {
        incrementCount: ({ context }) => ({ count: context.count + 1 }),
      },
      states: {
        idle: {
          on: {
            INCREMENT: { assign: 'incrementCount' },
          },
        },
      },
    };

    const machine = new StateMachine(config).start();
    const contextBefore = machine.getContext();
    const countBefore = contextBefore.count;

    machine.send({ type: 'INCREMENT' });

    // Original context reference should have same value
    expect(contextBefore.count).toBe(countBefore);
    // Machine context should be updated
    expect(machine.getContext().count).toBe(countBefore + 1);
  });

  it('should accumulate context updates correctly', () => {
    const config: StateMachineConfig<TestContext, TestEvents> = {
      initialContext: { log: [], count: 0 },
      initial: 'idle',
      reducers: {
        addLog1: ({ context }) => ({ log: [...context.log, '1'] }),
        addLog2: ({ context }) => ({ log: [...context.log, '2'] }),
        addLog3: ({ context }) => ({ log: [...context.log, '3'] }),
      },
      states: {
        idle: {
          onExit: ['addLog1'],
          on: {
            NEXT: { target: 'active', assign: 'addLog2' },
          },
        },
        active: {
          onEntry: ['addLog3'],
        },
      },
    };

    const machine = new StateMachine(config).start();
    machine.send({ type: 'NEXT' });

    const context = machine.getContext();
    expect(context.log).toEqual(['1', '2', '3']);
  });
});
