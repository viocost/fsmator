import { describe, it, expect } from 'vitest';
import type { StateValue, StateMachineConfig, StateContext, BaseEvent } from '../src/types';

describe('Nested States', () => {
  describe('StateValue type', () => {
    it('should accept simple string states', () => {
      const state: StateValue = 'idle';
      expect(state).toBe('idle');
    });

    it('should accept nested object states', () => {
      const state: StateValue = {
        submitting: 'validating',
      };
      expect(state).toEqual({ submitting: 'validating' });
    });

    it('should accept deeply nested states', () => {
      const state: StateValue = {
        parent: {
          child: {
            grandchild: 'active',
          },
        },
      };
      expect(state).toEqual({
        parent: {
          child: {
            grandchild: 'active',
          },
        },
      });
    });
  });

  describe('StateConfig with nested states', () => {
    interface TestContext extends StateContext {
      value: number;
    }

    type TestEvents = { type: 'NEXT' } | { type: 'BACK' };

    it('should allow nested states in configuration', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { value: 0 },
        initial: 'parent',
        states: {
          parent: {
            initial: 'child1',
            states: {
              child1: {
                on: {
                  NEXT: { target: 'child2' },
                },
              },
              child2: {
                on: {
                  BACK: { target: 'child1' },
                },
              },
            },
          },
        },
      };

      expect(config.states.parent.initial).toBe('child1');
      expect(config.states.parent.states?.child1).toBeDefined();
      expect(config.states.parent.states?.child2).toBeDefined();
    });

    it('should support deeply nested state hierarchies', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { value: 0 },
        initial: 'level1',
        states: {
          level1: {
            initial: 'level2',
            states: {
              level2: {
                initial: 'level3',
                states: {
                  level3: {
                    on: {
                      NEXT: { target: 'final' },
                    },
                  },
                  final: {},
                },
              },
            },
          },
        },
      };

      expect(config.states.level1.states?.level2.states?.level3).toBeDefined();
    });

    it('should allow transitions between nested states', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { value: 0 },
        initial: 'form',
        states: {
          form: {
            initial: 'editing',
            states: {
              editing: {
                on: {
                  NEXT: { target: 'validating' },
                },
              },
              validating: {
                on: {
                  NEXT: { target: 'submitting' },
                  BACK: { target: 'editing' },
                },
              },
              submitting: {},
            },
          },
          success: {},
        },
      };

      expect(config.states.form.states?.editing.on?.NEXT).toEqual({ target: 'validating' });
      expect(config.states.form.states?.validating.on?.BACK).toEqual({ target: 'editing' });
    });

    it('should support parallel states (multiple nested states)', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { value: 0 },
        initial: 'app',
        states: {
          app: {
            initial: 'main',
            states: {
              main: {},
              sidebar: {
                initial: 'collapsed',
                states: {
                  collapsed: {
                    on: { NEXT: { target: 'expanded' } },
                  },
                  expanded: {
                    on: { BACK: { target: 'collapsed' } },
                  },
                },
              },
            },
          },
        },
      };

      expect(config.states.app.states?.main).toBeDefined();
      expect(config.states.app.states?.sidebar.states?.collapsed).toBeDefined();
    });
  });
});
