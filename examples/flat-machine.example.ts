/**
 * Example: Flat State Machine
 * A simple traffic light with no nesting
 */

import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';

type TrafficLightContext = {
  cycleCount: number;
};

type TrafficLightEvent = { type: 'NEXT' } | { type: 'RESET' };

export function runFlatMachineExample() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 1: Flat State Machine (Traffic Light)');
  console.log('='.repeat(80));

  const config: StateMachineConfig<TrafficLightContext, TrafficLightEvent> = {
    initial: 'red',
    debug: true,
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

  const machine = new StateMachine(config);

  console.log('\n--- Cycling through lights ---');
  machine.send({ type: 'NEXT' }); // red → yellow
  machine.send({ type: 'NEXT' }); // yellow → green
  machine.send({ type: 'NEXT' }); // green → red (increments cycle)

  console.log('\n--- Reset cycle ---');
  machine.send({ type: 'NEXT' }); // red → yellow
  machine.send({ type: 'NEXT' }); // yellow → green
  machine.send({ type: 'RESET' }); // green → red (resets cycle)

  console.log('\n--- Final State ---');
  console.log('Configuration:', Array.from(machine.getConfiguration()));
  console.log('Context:', machine.getContext());
}
