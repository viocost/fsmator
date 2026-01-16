/**
 * Integration tests for always transitions in complex scenarios
 */

import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';

describe('Always Transitions - Integration', () => {
  describe('Form Validation Flow', () => {
    it('should auto-validate and auto-submit form when ready', () => {
      type Context = {
        name: string;
        email: string;
        isValid: boolean;
        isSubmitted: boolean;
      };

      type Event =
        | { type: 'SET_NAME'; value: string }
        | { type: 'SET_EMAIL'; value: string }
        | { type: 'SUBMIT' };

      const config: StateMachineConfig<Context, Event> = {
        initial: 'editing',
        initialContext: {
          name: '',
          email: '',
          isValid: false,
          isSubmitted: false,
        },
        guards: {
          isFormValid: ({ context }) => context.name.length > 0 && context.email.includes('@'),
        },
        reducers: {
          setName: ({ context, event }) => ({
            name: (event as { type: 'SET_NAME'; value: string }).value,
          }),
          setEmail: ({ context, event }) => ({
            email: (event as { type: 'SET_EMAIL'; value: string }).value,
          }),
          validate: ({ context }) => ({
            isValid: context.name.length > 0 && context.email.includes('@'),
          }),
          markSubmitted: () => ({ isSubmitted: true }),
        },
        states: {
          editing: {
            on: {
              SET_NAME: { target: 'editing', assign: 'setName' },
              SET_EMAIL: { target: 'editing', assign: 'setEmail' },
              SUBMIT: 'validating',
            },
          },
          validating: {
            onEntry: ['validate'],
            always: [{ target: 'submitting', guard: 'isFormValid' }, { target: 'invalid' }],
          },
          invalid: {
            on: {
              SET_NAME: { target: 'editing', assign: 'setName' },
              SET_EMAIL: { target: 'editing', assign: 'setEmail' },
            },
          },
          submitting: {
            onEntry: ['markSubmitted'],
            always: [{ target: 'success' }],
          },
          success: {},
        },
      };

      const machine = new StateMachine(config).start();

      // Try to submit without filling form
      machine.send({ type: 'SUBMIT' });
      expect(machine.getActiveStateNodes().has('invalid')).toBe(true);

      // Fill form
      machine.send({ type: 'SET_NAME', value: 'John' });
      machine.send({ type: 'SET_EMAIL', value: 'john@example.com' });

      // Submit valid form
      machine.send({ type: 'SUBMIT' });

      // Should auto-validate and auto-submit
      expect(machine.getActiveStateNodes().has('success')).toBe(true);
      expect(machine.getContext().isSubmitted).toBe(true);
    });
  });

  describe('State Machine with Auto-progression', () => {
    it('should auto-progress through loading states', () => {
      type Context = {
        loadingSteps: number;
        maxSteps: number;
      };

      type Event = { type: 'START' } | { type: 'TICK' };

      const config: StateMachineConfig<Context, Event> = {
        initial: 'idle',
        initialContext: { loadingSteps: 0, maxSteps: 3 },
        guards: {
          hasMoreSteps: ({ context }) => context.loadingSteps < context.maxSteps,
          isComplete: ({ context }) => context.loadingSteps >= context.maxSteps,
        },
        reducers: {
          incrementStep: ({ context }) => ({
            loadingSteps: context.loadingSteps + 1,
          }),
        },
        states: {
          idle: {
            on: { START: 'loading' },
          },
          loading: {
            always: [
              { target: 'complete', guard: 'isComplete' },
              {
                target: 'loading',
                assign: 'incrementStep',
                guard: 'hasMoreSteps',
              },
            ],
          },
          complete: {},
        },
      };

      const machine = new StateMachine(config).start();

      machine.send({ type: 'START' });

      // Should auto-increment and reach complete
      expect(machine.getActiveStateNodes().has('complete')).toBe(true);
      expect(machine.getContext().loadingSteps).toBe(3);
    });
  });

  describe('Router-like State Machine', () => {
    it('should auto-redirect based on permissions', () => {
      type Context = {
        isAuthenticated: boolean;
        isAdmin: boolean;
      };

      type Event =
        | { type: 'GO_HOME' }
        | { type: 'GO_ADMIN' }
        | { type: 'GO_LOGIN' }
        | { type: 'LOGIN'; isAdmin: boolean }
        | { type: 'LOGOUT' };

      const config: StateMachineConfig<Context, Event> = {
        initial: 'home',
        initialContext: {
          isAuthenticated: false,
          isAdmin: false,
        },
        guards: {
          isAuthenticated: ({ context }) => context.isAuthenticated,
          isNotAuthenticated: ({ context }) => !context.isAuthenticated,
          isAdmin: ({ context }) => context.isAuthenticated && context.isAdmin,
          isNotAdmin: ({ context }) => context.isAuthenticated && !context.isAdmin,
        },
        reducers: {
          login: ({ context, event }) => ({
            isAuthenticated: true,
            isAdmin: (event as { type: 'LOGIN'; isAdmin: boolean }).isAdmin,
          }),
          logout: () => ({
            isAuthenticated: false,
            isAdmin: false,
          }),
        },
        states: {
          home: {
            on: {
              GO_ADMIN: 'admin',
              GO_LOGIN: 'login',
              LOGOUT: { target: 'home', assign: 'logout' },
            },
          },
          admin: {
            always: [
              { target: 'login', guard: 'isNotAuthenticated' },
              { target: 'home', guard: 'isNotAdmin' },
            ],
            on: {
              GO_HOME: 'home',
              LOGOUT: { target: 'home', assign: 'logout' },
            },
          },
          login: {
            always: [{ target: 'home', guard: 'isAuthenticated' }],
            on: {
              LOGIN: { target: 'login', assign: 'login' },
              GO_HOME: 'home',
            },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // Try to access admin without auth - should redirect to login
      machine.send({ type: 'GO_ADMIN' });
      expect(machine.getActiveStateNodes().has('login')).toBe(true);

      // Login as regular user
      machine.send({ type: 'LOGIN', isAdmin: false });
      // Should auto-redirect to home after login
      expect(machine.getActiveStateNodes().has('home')).toBe(true);

      // Try to access admin as regular user - should redirect to home
      machine.send({ type: 'GO_ADMIN' });
      expect(machine.getActiveStateNodes().has('home')).toBe(true);

      // Logout, then login as admin
      machine.send({ type: 'LOGOUT' });
      expect(machine.getContext().isAuthenticated).toBe(false);

      machine.send({ type: 'GO_LOGIN' });
      machine.send({ type: 'LOGIN', isAdmin: true });

      // Should be at home after login
      expect(machine.getActiveStateNodes().has('home')).toBe(true);
      expect(machine.getContext().isAuthenticated).toBe(true);
      expect(machine.getContext().isAdmin).toBe(true);

      // Now try admin - should work
      machine.send({ type: 'GO_ADMIN' });
      expect(machine.getActiveStateNodes().has('admin')).toBe(true);
    });
  });

  describe('Wizard with Auto-skip', () => {
    it('should auto-skip optional steps', () => {
      type Context = {
        needsShipping: boolean;
        needsGiftWrap: boolean;
        step: number;
      };

      type Event = { type: 'NEXT' } | { type: 'BACK' };

      const config: StateMachineConfig<Context, Event> = {
        initial: 'cart',
        initialContext: {
          needsShipping: false,
          needsGiftWrap: false,
          step: 1,
        },
        guards: {
          needsShipping: ({ context }) => context.needsShipping,
          needsGiftWrap: ({ context }) => context.needsGiftWrap,
        },
        reducers: {
          incrementStep: ({ context }) => ({ step: context.step + 1 }),
        },
        states: {
          cart: {
            on: { NEXT: 'shipping' },
          },
          shipping: {
            always: [{ target: 'giftWrap', guard: { type: 'not', item: 'needsShipping' } }],
            on: {
              NEXT: { target: 'giftWrap', assign: 'incrementStep' },
              BACK: 'cart',
            },
          },
          giftWrap: {
            always: [{ target: 'payment', guard: { type: 'not', item: 'needsGiftWrap' } }],
            on: {
              NEXT: { target: 'payment', assign: 'incrementStep' },
              BACK: 'shipping',
            },
          },
          payment: {
            on: {
              NEXT: 'confirmation',
              BACK: 'giftWrap',
            },
          },
          confirmation: {},
        },
      };

      const machine = new StateMachine(config).start();

      // With both options disabled, should skip directly to payment
      machine.send({ type: 'NEXT' });

      expect(machine.getActiveStateNodes().has('payment')).toBe(true);
    });
  });

  describe('Traffic Light with Auto-transition', () => {
    it('should auto-transition through yellow to red', () => {
      type Context = {
        duration: number;
      };

      type Event = { type: 'TIMER' } | { type: 'EMERGENCY_STOP' };

      const config: StateMachineConfig<Context, Event> = {
        initial: 'green',
        initialContext: { duration: 0 },
        guards: {
          isYellow: ({ state }) => state === 'yellow',
        },
        states: {
          green: {
            on: {
              TIMER: 'yellow',
            },
          },
          yellow: {
            always: [{ target: 'red' }],
          },
          red: {
            on: {
              TIMER: 'green',
            },
          },
        },
      };

      const machine = new StateMachine(config).start();

      expect(machine.getActiveStateNodes().has('green')).toBe(true);

      // Transition to yellow should immediately transition to red
      machine.send({ type: 'TIMER' });

      expect(machine.getActiveStateNodes().has('red')).toBe(true);
    });
  });

  describe('Nested States with Always Transitions', () => {
    it('should handle always transitions in deeply nested states', () => {
      type Context = {
        autoProcess: boolean;
      };

      type Event = { type: 'START' } | { type: 'PROCESS' };

      const config: StateMachineConfig<Context, Event> = {
        initial: 'app',
        initialContext: { autoProcess: true },
        guards: {
          shouldAutoProcess: ({ context }) => context.autoProcess,
        },
        states: {
          app: {
            initial: 'workflow',
            states: {
              workflow: {
                initial: 'step1',
                states: {
                  step1: {
                    on: { START: 'step2' },
                  },
                  step2: {
                    always: [{ target: 'step3', guard: 'shouldAutoProcess' }],
                  },
                  step3: {
                    always: [{ target: 'done', guard: 'shouldAutoProcess' }],
                  },
                  done: {},
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();

      machine.send({ type: 'START' });

      // Should auto-process through step2 and step3 to done
      expect(machine.getActiveStateNodes().has('app.workflow.done')).toBe(true);
    });
  });
});
