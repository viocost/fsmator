/**
 * Example usage demonstrating README examples
 */

import { StateMachine } from './state-machine';
import type { StateMachineConfig, StateContext } from './types';

// Basic counter example from README
interface CounterContext extends StateContext {
  count: number;
}

type CounterEvents = { type: 'INCREMENT' } | { type: 'DECREMENT' } | { type: 'RESET' };

const counterConfig: StateMachineConfig<CounterContext, CounterEvents> = {
  initialContext: { count: 0 },
  initial: 'active',

  reducers: {
    increment: ({ context }) => ({ count: context.count + 1 }),
    decrement: ({ context }) => ({ count: context.count - 1 }),
    reset: () => ({ count: 0 }),
  },

  states: {
    active: {
      on: {
        INCREMENT: { assign: 'increment' },
        DECREMENT: { assign: 'decrement' },
        RESET: { assign: 'reset' },
      },
    },
  },
};

const counterMachine = new StateMachine(counterConfig);

counterMachine.send({ type: 'INCREMENT' });
counterMachine.send({ type: 'INCREMENT' });
console.log('Count after 2 increments:', counterMachine.getContext().count); // 2

counterMachine.send({ type: 'DECREMENT' });
console.log('Count after decrement:', counterMachine.getContext().count); // 1

counterMachine.send({ type: 'RESET' });
console.log('Count after reset:', counterMachine.getContext().count); // 0

// Hierarchical states example
interface FormContext extends StateContext {
  log: string[];
  formData: { name: string; email: string };
}

type FormEvents = { type: 'SUBMIT' } | { type: 'SUCCESS' };

const formConfig: StateMachineConfig<FormContext, FormEvents> = {
  initialContext: {
    log: [],
    formData: { name: '', email: '' },
  },
  initial: 'editing',

  reducers: {
    logEdit: ({ context }) => ({ log: [...context.log, 'editing'] }),
    logValidate: ({ context }) => ({ log: [...context.log, 'validating'] }),
    logSubmit: ({ context }) => ({ log: [...context.log, 'submitting'] }),
    logSuccess: ({ context }) => ({ log: [...context.log, 'success'] }),
  },

  states: {
    editing: {
      onEntry: ['logEdit'],
      on: {
        SUBMIT: { target: 'submitting' },
      },
    },

    submitting: {
      initial: 'validating',
      onEntry: ['logSubmit'],

      states: {
        validating: {
          onEntry: ['logValidate'],
          on: {
            SUCCESS: { target: 'done' },
          },
        },
        done: {
          onEntry: ['logSuccess'],
        },
      },
    },
  },
};

const formMachine = new StateMachine(formConfig);
console.log('Initial log:', formMachine.getContext().log); // ['editing']

formMachine.send({ type: 'SUBMIT' });
console.log('After submit:', formMachine.getContext().log); // ['editing', 'submitting', 'validating']
console.log('Configuration:', Array.from(formMachine.getConfiguration())); // ['submitting', 'submitting.validating']

formMachine.send({ type: 'SUCCESS' });
console.log('After success:', formMachine.getContext().log); // ['editing', 'submitting', 'validating', 'success']

export { counterMachine, formMachine };
