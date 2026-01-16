/**
 * Integration tests for flat-machine example
 */

import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';

type TrafficLightContext = {
  cycleCount: number;
};

type TrafficLightEvent = { type: 'NEXT' } | { type: 'RESET' };

describe('Flat Machine Integration (Traffic Light)', () => {
  function createTrafficLightMachine() {
    const config: StateMachineConfig<TrafficLightContext, TrafficLightEvent> = {
      initial: 'red',
      debug: false,
      initialContext: {
        cycleCount: 0,
      },
      states: {
        red: {
          on: {
            NEXT: { target: 'yellow', assign: 'incrementCycle' },
          },
        },
        yellow: {
          on: {
            NEXT: 'green',
          },
        },
        green: {
          on: {
            NEXT: 'red',
            RESET: { target: 'red', assign: 'resetCycle' },
          },
        },
      },
      reducers: {
        incrementCycle: ({ context }) => ({ cycleCount: context.cycleCount + 1 }),
        resetCycle: () => ({ cycleCount: 0 }),
      },
    };

    return new StateMachine(config);
  }

  it('should initialize to red state', () => {
    const machine = createTrafficLightMachine();

    expect(machine.getConfiguration().has('red')).toBe(true);
    expect(machine.getContext().cycleCount).toBe(0);
  });

  it('should cycle through all lights', () => {
    const machine = createTrafficLightMachine();

    // red → yellow
    machine.send({ type: 'NEXT' });
    expect(machine.getConfiguration().has('yellow')).toBe(true);
    expect(machine.getContext().cycleCount).toBe(1);

    // yellow → green
    machine.send({ type: 'NEXT' });
    expect(machine.getConfiguration().has('green')).toBe(true);
    expect(machine.getContext().cycleCount).toBe(1);

    // green → red
    machine.send({ type: 'NEXT' });
    expect(machine.getConfiguration().has('red')).toBe(true);
    expect(machine.getContext().cycleCount).toBe(1);
  });

  it('should increment cycle count on red to yellow transition', () => {
    const machine = createTrafficLightMachine();

    machine.send({ type: 'NEXT' }); // red → yellow (cycle 1)
    machine.send({ type: 'NEXT' }); // yellow → green
    machine.send({ type: 'NEXT' }); // green → red

    machine.send({ type: 'NEXT' }); // red → yellow (cycle 2)
    expect(machine.getContext().cycleCount).toBe(2);

    machine.send({ type: 'NEXT' }); // yellow → green
    machine.send({ type: 'NEXT' }); // green → red

    machine.send({ type: 'NEXT' }); // red → yellow (cycle 3)
    expect(machine.getContext().cycleCount).toBe(3);
  });

  it('should reset cycle count when RESET is sent from green', () => {
    const machine = createTrafficLightMachine();

    // Do a few cycles
    machine.send({ type: 'NEXT' }); // red → yellow (cycle 1)
    machine.send({ type: 'NEXT' }); // yellow → green
    machine.send({ type: 'NEXT' }); // green → red
    machine.send({ type: 'NEXT' }); // red → yellow (cycle 2)
    machine.send({ type: 'NEXT' }); // yellow → green

    expect(machine.getContext().cycleCount).toBe(2);

    // Reset from green
    machine.send({ type: 'RESET' });
    expect(machine.getConfiguration().has('red')).toBe(true);
    expect(machine.getContext().cycleCount).toBe(0);
  });

  it('should handle multiple complete cycles', () => {
    const machine = createTrafficLightMachine();

    // Complete cycle 1
    machine.send({ type: 'NEXT' }); // red → yellow
    machine.send({ type: 'NEXT' }); // yellow → green
    machine.send({ type: 'NEXT' }); // green → red

    // Complete cycle 2
    machine.send({ type: 'NEXT' }); // red → yellow
    machine.send({ type: 'NEXT' }); // yellow → green
    machine.send({ type: 'NEXT' }); // green → red

    // Complete cycle 3
    machine.send({ type: 'NEXT' }); // red → yellow
    machine.send({ type: 'NEXT' }); // yellow → green
    machine.send({ type: 'NEXT' }); // green → red

    expect(machine.getConfiguration().has('red')).toBe(true);
    expect(machine.getContext().cycleCount).toBe(3);
  });
});
