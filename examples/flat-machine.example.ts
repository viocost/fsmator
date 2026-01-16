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
    debug: false,
    timeTravel: true,
    initialContext: {
      cycleCount: 0,
    },
    states: {
      red: {
        type: 'parallel',
        on: {
          NEXT: { target: 'yellow', assign: 'incrementCycle' },
        },
        states: {
          dummyOne: {},
          dummyTwo: {}

        }
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

  const machine = new StateMachine(config).start();

  console.log('state counters', machine.getStateCounters())
  console.log('\n--- Cycling through lights ---');
  machine.send({ type: 'NEXT' }); // red → yellow

  console.log('state counters', machine.getStateCounters())
  machine.send({ type: 'NEXT' }); // yellow → green

  console.log('state counters', machine.getStateCounters())
  machine.send({ type: 'NEXT' }); // green → red (increments cycle)

  console.log('state counters', machine.getStateCounters())
  console.log('\n--- Reset cycle ---');
  machine.send({ type: 'NEXT' }); // red → yellow
  machine.send({ type: 'NEXT' }); // yellow → green
  machine.send({ type: 'RESET' }); // green → red (resets cycle)



  console.log('Configuration:', Array.from(machine.getActiveStateNodes()));
  console.log('Context:', machine.getContext());
  console.log('state counters', machine.getStateCounters())
}
