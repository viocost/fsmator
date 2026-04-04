/**
 * Tests for schema hash generation
 */

import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';

describe('Schema Hash', () => {
  it('should generate deterministic hash for same schema', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      initialContext: { count: 0 },
      assigns: {
        increment: ({ context }) => ({ count: context.count + 1 }),
      },
      states: {
        idle: {
          on: { INC: { target: 'active', assign: 'increment' } },
        },
        active: {
          on: { INC: { assign: 'increment' } },
        },
      },
    };

    const machine1 = new StateMachine(config);
    const machine2 = new StateMachine(config);

    expect(machine1.getHash()).toBe(machine2.getHash());
  });

  it('should generate same hash regardless of key order in config', () => {
    const config1: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      initialContext: { count: 0 },
      states: {
        idle: { on: { INC: 'active' } },
        active: { on: { INC: 'idle' } },
      },
    };

    const config2: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      initialContext: { count: 0 },
      states: {
        active: { on: { INC: 'idle' } },
        idle: { on: { INC: 'active' } },
      },
    };

    const machine1 = new StateMachine(config1);
    const machine2 = new StateMachine(config2);

    expect(machine1.getHash()).toBe(machine2.getHash());
  });

  it('should generate different hash for different structure', () => {
    const config1: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      initialContext: { count: 0 },
      states: {
        idle: { on: { INC: 'active' } },
        active: {},
      },
    };

    const config2: StateMachineConfig<{ count: number }, { type: 'INC' | 'DEC' }> = {
      initial: 'idle',
      initialContext: { count: 0 },
      states: {
        idle: { on: { INC: 'active', DEC: 'active' } },
        active: {},
      },
    };

    const machine1 = new StateMachine(config1);
    const machine2 = new StateMachine(config2);

    expect(machine1.getHash()).not.toBe(machine2.getHash());
  });

  it('should ignore implementation differences (same references)', () => {
    const config1: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      initialContext: { count: 0 },
      assigns: {
        increment: ({ context }) => ({ count: context.count + 1 }),
      },
      guards: {
        isPositive: ({ context }) => context.count > 0,
      },
      states: {
        idle: {
          on: { INC: { target: 'active', guard: 'isPositive', assign: 'increment' } },
        },
        active: {},
      },
    };

    const config2: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      initialContext: { count: 0 },
      assigns: {
        increment: ({ context }) => ({ count: context.count + 100 }), // Different implementation!
      },
      guards: {
        isPositive: ({ context }) => context.count >= 0, // Different implementation!
      },
      states: {
        idle: {
          on: { INC: { target: 'active', guard: 'isPositive', assign: 'increment' } },
        },
        active: {},
      },
    };

    const machine1 = new StateMachine(config1);
    const machine2 = new StateMachine(config2);

    // Should be same because schema structure is identical (only implementations differ)
    expect(machine1.getHash()).toBe(machine2.getHash());
  });

  it('should be stable across runtime state changes', () => {
    const config: StateMachineConfig<{ count: number }, { type: 'INC' }> = {
      initial: 'idle',
      initialContext: { count: 0 },
      assigns: {
        increment: ({ context }) => ({ count: context.count + 1 }),
      },
      states: {
        idle: {
          on: { INC: { target: 'active', assign: 'increment' } },
        },
        active: {
          on: { INC: { assign: 'increment' } },
        },
      },
    };

    const machine = new StateMachine(config).start();
    const hashBefore = machine.getHash();

    // Change runtime state
    machine.handle({ type: 'INC' });
    machine.handle({ type: 'INC' });
    machine.handle({ type: 'INC' });

    const hashAfter = machine.getHash();

    // Hash should not change with runtime state changes
    expect(hashAfter).toBe(hashBefore);
  });

  it('should include nested states in hash', () => {
    const config1: StateMachineConfig<{}, { type: 'GO' }> = {
      initial: 'parent',
      initialContext: {},
      states: {
        parent: {
          initial: 'child1',
          states: {
            child1: {},
            child2: {},
          },
        },
      },
    };

    const config2: StateMachineConfig<{}, { type: 'GO' }> = {
      initial: 'parent',
      initialContext: {},
      states: {
        parent: {
          initial: 'child1',
          states: {
            child1: {},
            child2: {},
            child3: {}, // Extra child
          },
        },
      },
    };

    const machine1 = new StateMachine(config1);
    const machine2 = new StateMachine(config2);

    expect(machine1.getHash()).not.toBe(machine2.getHash());
  });

  it('should include activities in hash', () => {
    const config1: StateMachineConfig<{}, { type: 'GO' }> = {
      initial: 'idle',
      initialContext: {},
      states: {
        idle: {
          activities: ['activity1'],
        },
      },
    };

    const config2: StateMachineConfig<{}, { type: 'GO' }> = {
      initial: 'idle',
      initialContext: {},
      states: {
        idle: {
          activities: ['activity1', 'activity2'],
        },
      },
    };

    const machine1 = new StateMachine(config1);
    const machine2 = new StateMachine(config2);

    expect(machine1.getHash()).not.toBe(machine2.getHash());
  });

  it('should return hex string', () => {
    const config: StateMachineConfig<{}, { type: 'GO' }> = {
      initial: 'idle',
      initialContext: {},
      states: {
        idle: {},
      },
    };

    const machine = new StateMachine(config);
    const hash = machine.getHash();

    // MD5 hex is 32 characters
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });
});
