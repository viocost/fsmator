/**
 * Example demonstrating debug logging functionality
 * Run with: npx tsx src/debug-example.ts
 */

import { StateMachine } from './state-machine';
import type { StateMachineConfig } from './types';

// Define context and events
type FormContext = {
  data: string;
  errors: string[];
  submitCount: number;
};

type FormEvent =
  | { type: 'EDIT' }
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS' }
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' };

// Create a simple form state machine with debug enabled
const config: StateMachineConfig<FormContext, FormEvent> = {
  initial: 'idle',
  debug: true, // Enable debug logging
  initialContext: {
    data: '',
    errors: [],
    submitCount: 0,
  },
  states: {
    idle: {
      on: {
        EDIT: 'editing',
      },
    },
    editing: {
      onEntry: ['logEditEntry'],
      onExit: ['logEditExit'],
      on: {
        SUBMIT: {
          target: 'submitting',
          guard: 'hasData',
          assign: 'incrementSubmitCount',
        },
      },
    },
    submitting: {
      initial: 'validating',
      onEntry: ['logSubmitEntry'],
      states: {
        validating: {
          onEntry: ['logValidateEntry'],
          on: {
            SUCCESS: 'success',
            ERROR: 'error',
          },
        },
        success: {
          onEntry: ['logSuccess'],
        },
        error: {
          onEntry: ['logError'],
          on: {
            RETRY: 'validating',
          },
        },
      },
    },
  },
  guards: {
    hasData: ({ context }) => {
      return context.data.length > 0;
    },
  },
  reducers: {
    logEditEntry: () => {
      console.log('    [USER CODE] Entered editing state');
      return {};
    },
    logEditExit: () => {
      console.log('    [USER CODE] Exited editing state');
      return {};
    },
    logSubmitEntry: () => {
      console.log('    [USER CODE] Started submission');
      return {};
    },
    logValidateEntry: () => {
      console.log('    [USER CODE] Validating form');
      return {};
    },
    logSuccess: () => {
      console.log('    [USER CODE] Form submitted successfully!');
      return {};
    },
    logError: ({ event }) => {
      console.log('    [USER CODE] Form submission failed:', (event as any).message);
      return { errors: [(event as any).message] };
    },
    incrementSubmitCount: ({ context }) => {
      return { submitCount: context.submitCount + 1 };
    },
  },
};

console.log('='.repeat(80));
console.log('Debug Logging Example');
console.log('='.repeat(80));

// Create the machine (will log initialization)
const machine = new StateMachine(config);

console.log('\n' + '='.repeat(80));
console.log('Scenario: Successful form submission');
console.log('='.repeat(80));

// Simulate a form flow
machine.send({ type: 'EDIT' });
machine.send({ type: 'SUBMIT' }); // Will fail guard - no data yet

// Add data and try again
(machine as any).context.data = 'test data';
machine.send({ type: 'SUBMIT' }); // Should succeed
machine.send({ type: 'SUCCESS' });

console.log('\n' + '='.repeat(80));
console.log('Scenario: Failed submission with retry');
console.log('='.repeat(80));

// Create a new machine for error scenario
const machine2 = new StateMachine({
  ...config,
  initialContext: { ...config.initialContext, data: 'test' },
});

machine2.send({ type: 'EDIT' });
machine2.send({ type: 'SUBMIT' });
machine2.send({ type: 'ERROR', message: 'Network error' });
machine2.send({ type: 'RETRY' });
machine2.send({ type: 'SUCCESS' });

console.log('\n' + '='.repeat(80));
console.log('Final Contexts:');
console.log('='.repeat(80));
console.log('Machine 1:', machine.getContext());
console.log('Machine 2:', machine2.getContext());
