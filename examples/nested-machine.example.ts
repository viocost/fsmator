/**
 * Example: Nested (Hierarchical) State Machine
 * A form with nested validation and submission states
 */

import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';

type FormContext = {
  formData: { name: string; email: string };
  errors: string[];
  submitAttempts: number;
};

type FormEvent =
  | { type: 'EDIT' }
  | { type: 'SUBMIT' }
  | { type: 'VALIDATE_SUCCESS' }
  | { type: 'VALIDATE_FAIL'; errors: string[] }
  | { type: 'API_SUCCESS' }
  | { type: 'API_ERROR'; error: string }
  | { type: 'RESET' };

export function runNestedMachineExample() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 2: Nested State Machine (Form with Validation)');
  console.log('='.repeat(80));

  const config: StateMachineConfig<FormContext, FormEvent> = {
    initial: 'idle',
    debug: true,
    initialContext: {
      formData: { name: '', email: '' },
      errors: [],
      submitAttempts: 0,
    },
    states: {
      idle: {
        onEntry: ['logIdle'],
        on: {
          EDIT: 'editing',
        },
      },
      editing: {
        onEntry: ['logEditing'],
        on: {
          SUBMIT: 'submitting',
        },
      },
      submitting: {
        initial: 'validating',
        onEntry: ['incrementAttempts'],
        onExit: ['logSubmittingExit'],
        states: {
          validating: {
            onEntry: ['logValidating'],
            on: {
              VALIDATE_SUCCESS: 'sending',
              VALIDATE_FAIL: { target: 'failed', assign: 'setErrors' },
            },
          },
          sending: {
            onEntry: ['logSending'],
            on: {
              API_SUCCESS: 'success',
              API_ERROR: { target: 'failed', assign: 'setApiError' },
            },
          },
          failed: {
            onEntry: ['logFailed'],
            on: {
              RESET: 'editing',
            },
          },
          success: {
            onEntry: ['logSuccess'],
            on: {
              RESET: 'idle',
            },
          },
        },
      },
    },
    reducers: {
      logIdle: () => {
        console.log('    [App] Entered idle state');
        return {};
      },
      logEditing: () => {
        console.log('    [App] User is editing form');
        return {};
      },
      logValidating: () => {
        console.log('    [App] Validating form data');
        return {};
      },
      logSending: () => {
        console.log('    [App] Sending to API');
        return {};
      },
      logFailed: () => {
        console.log('    [App] Submission failed');
        return {};
      },
      logSuccess: () => {
        console.log('    [App] Form submitted successfully!');
        return {};
      },
      logSubmittingExit: () => {
        console.log('    [App] Exiting submission flow');
        return {};
      },
      incrementAttempts: ({ context }) => ({
        submitAttempts: context.submitAttempts + 1,
      }),
      setErrors: ({ event }) => {
        if (event.type === 'VALIDATE_FAIL') {
          return { errors: event.errors };
        }
        return {};
      },
      setApiError: ({ event }) => {
        if (event.type === 'API_ERROR') {
          return { errors: [event.error] };
        }
        return {};
      },
    },
  };

  const machine = new StateMachine(config);

  console.log('\n--- Successful submission flow ---');
  machine.send({ type: 'EDIT' });
  machine.send({ type: 'SUBMIT' });
  machine.send({ type: 'VALIDATE_SUCCESS' });
  machine.send({ type: 'API_SUCCESS' });

  console.log('\n--- Failed validation flow ---');
  machine.send({ type: 'RESET' });
  machine.send({ type: 'EDIT' });
  machine.send({ type: 'SUBMIT' });
  machine.send({ type: 'VALIDATE_FAIL', errors: ['Invalid email'] });

  console.log('\n--- Final State ---');
  console.log('Configuration:', Array.from(machine.getActiveStateNodes()));
  console.log('Context:', machine.getContext());
}
