import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig, StateContext } from '../src/types';

interface TestContext extends StateContext {
  value: number;
}

type TestEvent = { type: 'NEXT' } | { type: 'RESET' };

describe('Parallel State Transitions', () => {
  it('should not duplicate transitions from parallel state parent', () => {
    const config: StateMachineConfig<TestContext, TestEvent> = {
      initialContext: { value: 0 },
      initial: 'red',
      states: {
        red: {
          type: 'parallel',
          on: {
            NEXT: 'yellow',
          },
          states: {
            regionA: {},
            regionB: {},
          },
        },
        yellow: {
          on: {
            NEXT: 'green',
          },
        },
        green: {},
      },
    };

    const machine = new StateMachine(config).start();

    // Initial state: red with both regions
    expect(machine.getStateValue()).toEqual({ red: { regionA: {}, regionB: {} } });
    expect(Array.from(machine.getActiveStateNodes())).toEqual([
      'red.regionA',
      'red.regionB',
      'red',
    ]);

    // Transition to yellow
    machine.send({ type: 'NEXT' });

    // Should be in yellow, not duplicate
    expect(machine.getStateValue()).toBe('yellow');
    expect(Array.from(machine.getActiveStateNodes())).toEqual(['yellow']);

    // Check state counters
    const counters = machine.getStateCounters();
    expect(counters.red).toBe(1); // Entered once
    expect(counters['red.regionA']).toBe(1); // Entered once
    expect(counters['red.regionB']).toBe(1); // Entered once
    expect(counters.yellow).toBe(1); // Entered once (not twice!)
  });

  it('should properly clean up parallel region children on transition', () => {
    const config: StateMachineConfig<TestContext, TestEvent> = {
      initialContext: { value: 0 },
      initial: 'parallel',
      states: {
        parallel: {
          type: 'parallel',
          on: {
            NEXT: 'atomic',
          },
          states: {
            regionA: {},
            regionB: {},
          },
        },
        atomic: {
          on: {
            NEXT: 'parallel',
          },
        },
      },
    };

    const machine = new StateMachine(config).start();

    // Initial: parallel with both regions
    expect(Array.from(machine.getActiveStateNodes()).sort()).toEqual([
      'parallel',
      'parallel.regionA',
      'parallel.regionB',
    ]);

    // Transition to atomic
    machine.send({ type: 'NEXT' });

    // Should only be in atomic, no leftover parallel regions
    expect(Array.from(machine.getActiveStateNodes())).toEqual(['atomic']);

    // Transition back to parallel
    machine.send({ type: 'NEXT' });

    // Should be back in parallel with both regions
    expect(Array.from(machine.getActiveStateNodes()).sort()).toEqual([
      'parallel',
      'parallel.regionA',
      'parallel.regionB',
    ]);

    // Check counters
    const counters = machine.getStateCounters();
    expect(counters.parallel).toBe(2); // Entered twice
    expect(counters['parallel.regionA']).toBe(2); // Entered twice
    expect(counters['parallel.regionB']).toBe(2); // Entered twice
    expect(counters.atomic).toBe(1); // Entered once
  });

  it('should handle transitions from parallel state with nested compound regions', () => {
    const config: StateMachineConfig<TestContext, TestEvent> = {
      initialContext: { value: 0 },
      initial: 'parallel',
      states: {
        parallel: {
          type: 'parallel',
          on: {
            NEXT: 'done',
          },
          states: {
            regionA: {
              initial: 'a1',
              states: {
                a1: {},
                a2: {},
              },
            },
            regionB: {
              initial: 'b1',
              states: {
                b1: {},
                b2: {},
              },
            },
          },
        },
        done: {},
      },
    };

    const machine = new StateMachine(config).start();

    // Initial: parallel with nested states
    expect(Array.from(machine.getActiveStateNodes()).sort()).toEqual([
      'parallel',
      'parallel.regionA',
      'parallel.regionA.a1',
      'parallel.regionB',
      'parallel.regionB.b1',
    ]);

    // Transition to done
    machine.send({ type: 'NEXT' });

    // Should only be in done, all parallel regions and their children cleaned up
    expect(Array.from(machine.getActiveStateNodes())).toEqual(['done']);

    // Check counters - each state entered only once
    const counters = machine.getStateCounters();
    expect(counters.parallel).toBe(1);
    expect(counters['parallel.regionA']).toBe(1);
    expect(counters['parallel.regionA.a1']).toBe(1);
    expect(counters['parallel.regionB']).toBe(1);
    expect(counters['parallel.regionB.b1']).toBe(1);
    expect(counters.done).toBe(1);
  });
});
