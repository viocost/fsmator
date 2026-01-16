/**
 * Integration tests for nested-machine example
 */

import { describe, it, expect } from 'vitest';
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

describe('Nested Machine Integration (Form Validation)', () => {
  function createFormMachine() {
    const config: StateMachineConfig<FormContext, FormEvent> = {
      initial: 'idle',
      debug: false,
      initialContext: {
        formData: { name: '', email: '' },
        errors: [],
        submitAttempts: 0,
      },
      states: {
        idle: {
          on: {
            EDIT: 'editing',
          },
        },
        editing: {
          on: {
            SUBMIT: 'submitting',
          },
        },
        submitting: {
          initial: 'validating',
          onEntry: ['incrementAttempts'],
          states: {
            validating: {
              on: {
                VALIDATE_SUCCESS: 'sending',
                VALIDATE_FAIL: { target: 'failed', assign: 'setErrors' },
              },
            },
            sending: {
              on: {
                API_SUCCESS: 'success',
                API_ERROR: { target: 'failed', assign: 'setApiError' },
              },
            },
            failed: {
              on: {
                RESET: 'editing',
              },
            },
            success: {
              on: {
                RESET: 'idle',
              },
            },
          },
        },
      },
      reducers: {
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

    return new StateMachine(config);
  }

  it('should initialize to idle state', () => {
    const machine = createFormMachine();

    expect(machine.getConfiguration().has('idle')).toBe(true);
    expect(machine.getContext().submitAttempts).toBe(0);
    expect(machine.getContext().errors).toEqual([]);
  });

  it('should transition from idle to editing', () => {
    const machine = createFormMachine();

    machine.send({ type: 'EDIT' });
    expect(machine.getConfiguration().has('editing')).toBe(true);
  });

  it('should enter submitting.validating when submitting', () => {
    const machine = createFormMachine();

    machine.send({ type: 'EDIT' });
    machine.send({ type: 'SUBMIT' });

    expect(machine.getConfiguration().has('submitting')).toBe(true);
    expect(machine.getConfiguration().has('submitting.validating')).toBe(true);
    expect(machine.getContext().submitAttempts).toBe(1);
  });

  it('should complete successful submission flow', () => {
    const machine = createFormMachine();

    machine.send({ type: 'EDIT' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'VALIDATE_SUCCESS' });

    expect(machine.getConfiguration().has('submitting.sending')).toBe(true);

    machine.send({ type: 'API_SUCCESS' });

    expect(machine.getConfiguration().has('submitting.success')).toBe(true);
    expect(machine.getContext().submitAttempts).toBe(1);
  });

  it('should handle validation failure', () => {
    const machine = createFormMachine();

    machine.send({ type: 'EDIT' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'VALIDATE_FAIL', errors: ['Invalid email', 'Name required'] });

    expect(machine.getConfiguration().has('submitting.failed')).toBe(true);
    expect(machine.getContext().errors).toEqual(['Invalid email', 'Name required']);
  });

  it('should handle API error', () => {
    const machine = createFormMachine();

    machine.send({ type: 'EDIT' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'VALIDATE_SUCCESS' });
    machine.send({ type: 'API_ERROR', error: 'Network error' });

    expect(machine.getConfiguration().has('submitting.failed')).toBe(true);
    expect(machine.getContext().errors).toEqual(['Network error']);
  });

  it('should reset from failed state to editing', () => {
    const machine = createFormMachine();

    machine.send({ type: 'EDIT' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'VALIDATE_FAIL', errors: ['Error'] });

    expect(machine.getConfiguration().has('submitting.failed')).toBe(true);

    machine.send({ type: 'RESET' });

    expect(machine.getConfiguration().has('editing')).toBe(true);
    expect(machine.getConfiguration().has('submitting')).toBe(false);
  });

  it('should reset from success state to idle', () => {
    const machine = createFormMachine();

    machine.send({ type: 'EDIT' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'VALIDATE_SUCCESS' });
    machine.send({ type: 'API_SUCCESS' });

    expect(machine.getConfiguration().has('submitting.success')).toBe(true);

    machine.send({ type: 'RESET' });

    expect(machine.getConfiguration().has('idle')).toBe(true);
    expect(machine.getConfiguration().has('submitting')).toBe(false);
  });

  it('should track multiple submission attempts', () => {
    const machine = createFormMachine();

    // First attempt
    machine.send({ type: 'EDIT' });
    machine.send({ type: 'SUBMIT' });
    expect(machine.getContext().submitAttempts).toBe(1);

    machine.send({ type: 'VALIDATE_FAIL', errors: ['Error'] });
    machine.send({ type: 'RESET' });

    // Second attempt
    machine.send({ type: 'SUBMIT' });
    expect(machine.getContext().submitAttempts).toBe(2);

    machine.send({ type: 'VALIDATE_FAIL', errors: ['Error'] });
    machine.send({ type: 'RESET' });

    // Third attempt
    machine.send({ type: 'SUBMIT' });
    expect(machine.getContext().submitAttempts).toBe(3);
  });

  it('should handle complete retry flow', () => {
    const machine = createFormMachine();

    // Failed submission
    machine.send({ type: 'EDIT' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'VALIDATE_FAIL', errors: ['Invalid'] });

    // Retry
    machine.send({ type: 'RESET' });
    machine.send({ type: 'SUBMIT' });
    machine.send({ type: 'VALIDATE_SUCCESS' });
    machine.send({ type: 'API_SUCCESS' });

    expect(machine.getConfiguration().has('submitting.success')).toBe(true);
    expect(machine.getContext().submitAttempts).toBe(2);
  });
});
