/**
 * Tests for always transitions (eventless transitions)
 */

import { describe, it, expect } from 'vitest';
import { StateMachine } from './state-machine';
import type { StateMachineConfig } from './types';

describe('Always Transitions', () => {
  describe('Basic Always Transitions', () => {
    it('should take always transition immediately after initialization', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'NEXT' }> = {
        initial: 'checking',
        initialContext: { count: 0 },
        states: {
          checking: {
            always: [{ target: 'ready' }],
          },
          ready: {},
        },
      };

      const machine = new StateMachine(config);

      // Should immediately transition to ready due to always transition
      expect(machine.getConfiguration().has('ready')).toBe(true);
      expect(machine.getConfiguration().has('checking')).toBe(false);
    });

    it('should take always transition after event transition', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'START' } | { type: 'NEXT' }> = {
        initial: 'idle',
        initialContext: { count: 0 },
        states: {
          idle: {
            on: { START: 'processing' },
          },
          processing: {
            always: [{ target: 'done' }],
          },
          done: {},
        },
      };

      const machine = new StateMachine(config);

      expect(machine.getConfiguration().has('idle')).toBe(true);

      machine.send({ type: 'START' });

      // Should transition to processing, then immediately to done
      expect(machine.getConfiguration().has('done')).toBe(true);
      expect(machine.getConfiguration().has('processing')).toBe(false);
    });

    it('should not take always transition when guard fails', () => {
      const config: StateMachineConfig<
        { count: number },
        { type: 'START' } | { type: 'INCREMENT' }
      > = {
        initial: 'idle',
        initialContext: { count: 0 },
        guards: {
          isReady: ({ context }) => context.count >= 3,
        },
        states: {
          idle: {
            on: {
              START: 'waiting',
              INCREMENT: { target: 'idle', assign: 'increment' },
            },
          },
          waiting: {
            always: [{ target: 'done', guard: 'isReady' }],
          },
          done: {},
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
      };

      const machine = new StateMachine(config);

      machine.send({ type: 'START' });

      // Should stay in waiting because guard fails (count < 3)
      expect(machine.getConfiguration().has('waiting')).toBe(true);
      expect(machine.getConfiguration().has('done')).toBe(false);
    });

    it('should take always transition when guard passes', () => {
      const config: StateMachineConfig<
        { count: number },
        { type: 'START' } | { type: 'INCREMENT' }
      > = {
        initial: 'idle',
        initialContext: { count: 5 },
        guards: {
          isReady: ({ context }) => context.count >= 3,
        },
        states: {
          idle: {
            on: { START: 'waiting' },
          },
          waiting: {
            always: [{ target: 'done', guard: 'isReady' }],
          },
          done: {},
        },
      };

      const machine = new StateMachine(config);

      machine.send({ type: 'START' });

      // Should transition to done because guard passes (count >= 3)
      expect(machine.getConfiguration().has('done')).toBe(true);
      expect(machine.getConfiguration().has('waiting')).toBe(false);
    });
  });

  describe('Always Transitions with Multiple Guards', () => {
    it('should select first enabled always transition', () => {
      const config: StateMachineConfig<{ value: string }, { type: 'START' } | { type: 'NEXT' }> = {
        initial: 'idle',
        initialContext: { value: 'medium' },
        guards: {
          isLow: ({ context }) => context.value === 'low',
          isMedium: ({ context }) => context.value === 'medium',
          isHigh: ({ context }) => context.value === 'high',
        },
        states: {
          idle: {
            on: { START: 'checking' },
          },
          checking: {
            always: [
              { target: 'low', guard: 'isLow' },
              { target: 'medium', guard: 'isMedium' },
              { target: 'high', guard: 'isHigh' },
              { target: 'unknown' },
            ],
          },
          low: {},
          medium: {},
          high: {},
          unknown: {},
        },
      };

      const machine = new StateMachine(config);

      machine.send({ type: 'START' });

      // Should transition to medium (first guard that passes)
      expect(machine.getConfiguration().has('medium')).toBe(true);
    });

    it('should take fallback always transition when no guards pass', () => {
      const config: StateMachineConfig<{ value: string }, { type: 'START' }> = {
        initial: 'idle',
        initialContext: { value: 'other' },
        guards: {
          isLow: ({ context }) => context.value === 'low',
          isHigh: ({ context }) => context.value === 'high',
        },
        states: {
          idle: {
            on: { START: 'checking' },
          },
          checking: {
            always: [
              { target: 'low', guard: 'isLow' },
              { target: 'high', guard: 'isHigh' },
              { target: 'unknown' }, // Fallback (no guard)
            ],
          },
          low: {},
          high: {},
          unknown: {},
        },
      };

      const machine = new StateMachine(config);

      machine.send({ type: 'START' });

      // Should transition to unknown (fallback)
      expect(machine.getConfiguration().has('unknown')).toBe(true);
    });
  });

  describe('Always Transitions with Context Updates', () => {
    it('should execute assign action during always transition', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'START' }> = {
        initial: 'idle',
        initialContext: { count: 0 },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
        states: {
          idle: {
            on: { START: 'processing' },
          },
          processing: {
            always: [{ target: 'done', assign: 'increment' }],
          },
          done: {},
        },
      };

      const machine = new StateMachine(config);

      expect(machine.getContext().count).toBe(0);

      machine.send({ type: 'START' });

      expect(machine.getConfiguration().has('done')).toBe(true);
      expect(machine.getContext().count).toBe(1);
    });

    it('should re-evaluate always transitions after context update', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'START' } | { type: 'NEXT' }> = {
        initial: 'idle',
        initialContext: { count: 0 },
        guards: {
          isDone: ({ context }) => context.count >= 3,
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
        states: {
          idle: {
            on: { START: 'incrementing' },
          },
          incrementing: {
            always: [
              { target: 'done', guard: 'isDone' },
              { target: 'incrementing', assign: 'increment' },
            ],
          },
          done: {},
        },
      };

      const machine = new StateMachine(config);

      machine.send({ type: 'START' });

      // Should loop through incrementing until count >= 3
      expect(machine.getConfiguration().has('done')).toBe(true);
      expect(machine.getContext().count).toBe(3);
    });
  });

  describe('Always Transitions with Entry/Exit Actions', () => {
    it('should execute entry and exit actions during always transitions', () => {
      const events: string[] = [];

      const config: StateMachineConfig<{ log: string[] }, { type: 'START' }> = {
        initial: 'idle',
        initialContext: { log: [] },
        reducers: {
          logEntry: ({ context, state }) => ({
            log: [...context.log, `enter:${state}`],
          }),
          logExit: ({ context, state }) => ({
            log: [...context.log, `exit:${state}`],
          }),
        },
        states: {
          idle: {
            on: { START: 'intermediate' },
          },
          intermediate: {
            onEntry: ['logEntry'],
            onExit: ['logExit'],
            always: [{ target: 'final' }],
          },
          final: {
            onEntry: ['logEntry'],
          },
        },
      };

      const machine = new StateMachine(config);

      machine.send({ type: 'START' });

      const log = machine.getContext().log;
      expect(log).toContain('enter:intermediate');
      expect(log).toContain('exit:intermediate');
      expect(log).toContain('enter:final');

      // Verify order: enter intermediate, exit intermediate, enter final
      const enterIntermediateIdx = log.indexOf('enter:intermediate');
      const exitIntermediateIdx = log.indexOf('exit:intermediate');
      const enterFinalIdx = log.indexOf('enter:final');

      expect(enterIntermediateIdx).toBeLessThan(exitIntermediateIdx);
      expect(exitIntermediateIdx).toBeLessThan(enterFinalIdx);
    });
  });

  describe('Nested Always Transitions', () => {
    it('should evaluate always transitions in nested states', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'START' } | { type: 'NEXT' }> = {
        initial: 'parent',
        initialContext: { count: 0 },
        states: {
          parent: {
            initial: 'checking',
            states: {
              checking: {
                always: [{ target: 'ready' }],
              },
              ready: {},
            },
          },
        },
      };

      const machine = new StateMachine(config);

      // Should immediately transition to parent.ready
      expect(machine.getConfiguration().has('parent.ready')).toBe(true);
      expect(machine.getConfiguration().has('parent.checking')).toBe(false);
    });

    it('should transition from nested state to parent level via always', () => {
      const config: StateMachineConfig<
        { shouldExit: boolean },
        { type: 'START' } | { type: 'TOGGLE' }
      > = {
        initial: 'parent',
        initialContext: { shouldExit: true },
        guards: {
          shouldExit: ({ context }) => context.shouldExit,
        },
        states: {
          parent: {
            initial: 'child',
            states: {
              child: {
                always: [{ target: 'sibling', guard: 'shouldExit' }],
              },
            },
          },
          sibling: {},
        },
      };

      const machine = new StateMachine(config);

      // Should transition from parent.child to sibling
      expect(machine.getConfiguration().has('sibling')).toBe(true);
      expect(machine.getConfiguration().has('parent')).toBe(false);
    });
  });

  describe('Always Transitions from Ancestors', () => {
    it('should check always transitions on ancestor states', () => {
      const config: StateMachineConfig<{ shouldExit: boolean }, { type: 'START' }> = {
        initial: 'parent',
        initialContext: { shouldExit: true },
        guards: {
          shouldExit: ({ context }) => context.shouldExit,
        },
        states: {
          parent: {
            initial: 'child',
            always: [{ target: 'done', guard: 'shouldExit' }],
            states: {
              child: {},
            },
          },
          done: {},
        },
      };

      const machine = new StateMachine(config);

      // Parent's always transition should fire, exiting to done
      expect(machine.getConfiguration().has('done')).toBe(true);
      expect(machine.getConfiguration().has('parent')).toBe(false);
    });
  });

  describe('Internal Always Transitions', () => {
    it('should support internal always transitions (no target)', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'START' }> = {
        initial: 'idle',
        initialContext: { count: 0 },
        guards: {
          shouldIncrement: ({ context }) => context.count < 5,
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
        states: {
          idle: {
            on: { START: 'active' },
          },
          active: {
            always: [{ assign: 'increment', guard: 'shouldIncrement' }],
          },
        },
      };

      const machine = new StateMachine(config);

      machine.send({ type: 'START' });

      // Should stay in active but increment context once
      expect(machine.getConfiguration().has('active')).toBe(true);
      expect(machine.getContext().count).toBe(1);
    });
  });

  describe('Always Transitions - Edge Cases', () => {
    it('should handle multiple always transitions in sequence', () => {
      const config: StateMachineConfig<{ step: number }, { type: 'START' }> = {
        initial: 'step1',
        initialContext: { step: 1 },
        reducers: {
          incrementStep: ({ context }) => ({ step: context.step + 1 }),
        },
        states: {
          step1: {
            always: [{ target: 'step2', assign: 'incrementStep' }],
          },
          step2: {
            always: [{ target: 'step3', assign: 'incrementStep' }],
          },
          step3: {
            always: [{ target: 'final', assign: 'incrementStep' }],
          },
          final: {},
        },
      };

      const machine = new StateMachine(config);

      // Should chain through all steps to final
      expect(machine.getConfiguration().has('final')).toBe(true);
      expect(machine.getContext().step).toBe(4);
    });

    it('should prevent infinite loops with max iterations', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'START' }> = {
        initial: 'looping',
        initialContext: { count: 0 },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
        states: {
          looping: {
            // This will cause infinite loop
            always: [{ target: 'looping', assign: 'increment' }],
          },
        },
      };

      expect(() => {
        new StateMachine(config);
      }).toThrow('Maximum always transition iterations reached');
    });

    it('should not take always transition when no guard and no target on non-matching event', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'START' } | { type: 'NEXT' }> = {
        initial: 'idle',
        initialContext: { count: 0 },
        states: {
          idle: {
            on: { START: 'active' },
            always: [], // Empty always array
          },
          active: {},
        },
      };

      const machine = new StateMachine(config);

      // Sending NEXT should not trigger any transition
      machine.send({ type: 'NEXT' });

      expect(machine.getConfiguration().has('idle')).toBe(true);
    });
  });
});
