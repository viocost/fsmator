/**
 * Tests for debug logging functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';

describe('Debug Logging', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    // Spy on console.log
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.log
    consoleLogSpy.mockRestore();
  });

  it('should not log when debug is disabled (default)', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      initialContext: { count: 0 },
      states: {
        idle: {
          on: {
            INC: 'active',
          },
        },
        active: {},
      },
    };

    const machine = new StateMachine(config).start();
    machine.send({ type: 'INC' });

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should not log when debug is explicitly false', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      debug: false,
      initialContext: { count: 0 },
      states: {
        idle: {
          on: {
            INC: 'active',
          },
        },
        active: {},
      },
    };

    const machine = new StateMachine(config).start();
    machine.send({ type: 'INC' });

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should log initialization when debug is enabled', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      debug: true,
      initialContext: { count: 0 },
      states: {
        idle: {},
      },
    };

    new StateMachine(config).start();

    // Check for initialization logs
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Initializing'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Entering state: idle'));
  });

  it('should log event and transitions when debug is enabled', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      debug: true,
      initialContext: { count: 0 },
      states: {
        idle: {
          on: {
            INC: 'active',
          },
        },
        active: {},
      },
    };

    const machine = new StateMachine(config).start();
    consoleLogSpy.mockClear(); // Clear initialization logs

    machine.send({ type: 'INC' });

    // Check for event and transition logs
    const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);

    expect(logCalls.some((log: string) => log.includes('Event received: INC'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('Checking transitions'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('Transition:'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('Exiting state: idle'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('Entering state: active'))).toBe(true);
  });

  it('should log guard evaluation when debug is enabled', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      debug: true,
      initialContext: { count: 0 },
      states: {
        idle: {
          on: {
            INC: {
              target: 'active',
              guard: 'isValid',
            },
          },
        },
        active: {},
      },
      guards: {
        isValid: () => true,
      },
    };

    const machine = new StateMachine(config).start();
    consoleLogSpy.mockClear();

    machine.send({ type: 'INC' });

    const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
    expect(logCalls.some((log: string) => log.includes('Guard "isValid"'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('PASS'))).toBe(true);
  });

  it('should log failed guard evaluation', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      debug: true,
      initialContext: { count: 0 },
      states: {
        idle: {
          on: {
            INC: {
              target: 'active',
              guard: 'isValid',
            },
          },
        },
        active: {},
      },
      guards: {
        isValid: () => false,
      },
    };

    const machine = new StateMachine(config).start();
    consoleLogSpy.mockClear();

    machine.send({ type: 'INC' });

    const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
    expect(logCalls.some((log: string) => log.includes('Guard "isValid"'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('FAIL'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('No enabled transitions'))).toBe(true);
  });

  it('should log reducer execution and context updates', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      debug: true,
      initialContext: { count: 0 },
      states: {
        idle: {
          on: {
            INC: {
              target: 'active',
              assign: 'increment',
            },
          },
        },
        active: {},
      },
      reducers: {
        increment: ({ context }) => ({ count: context.count + 1 }),
      },
    };

    const machine = new StateMachine(config).start();
    consoleLogSpy.mockClear();

    machine.send({ type: 'INC' });

    const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
    expect(logCalls.some((log: string) => log.includes('Executing reducer: increment'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('Context updates'))).toBe(true);
  });

  it('should log onEntry and onExit actions', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      debug: true,
      initialContext: { count: 0 },
      states: {
        idle: {
          onExit: ['logExit'],
          on: {
            INC: 'active',
          },
        },
        active: {
          onEntry: ['logEntry'],
        },
      },
      reducers: {
        logEntry: () => ({}),
        logExit: () => ({}),
      },
    };

    const machine = new StateMachine(config).start();
    consoleLogSpy.mockClear();

    machine.send({ type: 'INC' });

    const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
    expect(logCalls.some((log: string) => log.includes('Exiting state: idle'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('Executing reducer: logExit'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('Entering state: active'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('Executing reducer: logEntry'))).toBe(true);
  });

  it('should log LCA, exit set, and entry set for nested transitions', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'GO' }> = {
      initial: 'parent1',
      debug: true,
      initialContext: { count: 0 },
      states: {
        parent1: {
          initial: 'child1',
          states: {
            child1: {
              on: {
                GO: 'parent2.child2',
              },
            },
          },
        },
        parent2: {
          initial: 'child2',
          states: {
            child2: {},
          },
        },
      },
    };

    const machine = new StateMachine(config).start();
    consoleLogSpy.mockClear();

    machine.send({ type: 'GO' });

    const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
    expect(logCalls.some((log: string) => log.includes('LCA:'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('Exit set:'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('Entry set:'))).toBe(true);
  });

  it('should log self-transitions', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'REFRESH' }> = {
      initial: 'idle',
      debug: true,
      initialContext: { count: 0 },
      states: {
        idle: {
          on: {
            REFRESH: 'idle',
          },
        },
      },
    };

    const machine = new StateMachine(config).start();
    consoleLogSpy.mockClear();

    machine.send({ type: 'REFRESH' });

    const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
    expect(logCalls.some((log: string) => log.includes('Self-transition'))).toBe(true);
  });

  it('should log internal transitions', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      debug: true,
      initialContext: { count: 0 },
      states: {
        idle: {
          on: {
            INC: {
              // No target = internal transition
              assign: 'increment',
            },
          },
        },
      },
      reducers: {
        increment: ({ context }) => ({ count: context.count + 1 }),
      },
    };

    const machine = new StateMachine(config).start();
    consoleLogSpy.mockClear();

    machine.send({ type: 'INC' });

    const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
    expect(logCalls.some((log: string) => log.includes('Internal transition'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('idle'))).toBe(true);
  });

  it('should log compound guard evaluation (and/or/not)', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'GO' }> = {
      initial: 'idle',
      debug: true,
      initialContext: { count: 5 },
      states: {
        idle: {
          on: {
            GO: {
              target: 'active',
              guard: {
                type: 'and',
                items: ['isPositive', 'isLessThan10'],
              },
            },
          },
        },
        active: {},
      },
      guards: {
        isPositive: ({ context }) => context.count > 0,
        isLessThan10: ({ context }) => context.count < 10,
      },
    };

    const machine = new StateMachine(config).start();
    consoleLogSpy.mockClear();

    machine.send({ type: 'GO' });

    const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
    expect(logCalls.some((log: string) => log.includes('Evaluating AND guard'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('Guard "isPositive"'))).toBe(true);
    expect(logCalls.some((log: string) => log.includes('Guard "isLessThan10"'))).toBe(true);
  });

  it('should log final configuration after transitions', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      debug: true,
      initialContext: { count: 0 },
      states: {
        idle: {
          on: {
            INC: 'active',
          },
        },
        active: {},
      },
    };

    const machine = new StateMachine(config).start();
    consoleLogSpy.mockClear();

    machine.send({ type: 'INC' });

    const logCalls = consoleLogSpy.mock.calls.map((call: any) => call[0]);
    expect(logCalls.some((log: string) => log.includes('New configuration'))).toBe(true);
  });
});
