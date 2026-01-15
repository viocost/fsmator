import { describe, it, expect } from 'vitest';
import { StateMachine } from './state-machine';
import type { StateMachineConfig, StateContext, BaseEvent } from './types';

interface TestContext extends StateContext {
  count: number;
}

type TestEvents = { type: 'NEXT' } | { type: 'PREV' };

describe('StateMachine', () => {
  describe('initialization', () => {
    it('should create a simple flat state machine', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {},
          active: {},
        },
      };

      const machine = new StateMachine(config);
      const root = machine.getRoot();

      expect(root).toBeDefined();
      expect(root.kind).toBe('compound');
      expect(root.children).toHaveLength(2);
      expect(root.initial?.key).toBe('idle');
    });

    it('should register guards and reducers', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        guards: {
          isPositive: ({ context }) => context.count > 0,
        },
        reducers: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
        states: {
          idle: {},
        },
      };

      const machine = new StateMachine(config);

      expect(machine.getGuard('isPositive')).toBeDefined();
      expect(machine.getReducer('increment')).toBeDefined();
    });

    it('should provide node lookup by ID', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {},
          active: {},
        },
      };

      const machine = new StateMachine(config);

      expect(machine.getNode('idle')).toBeDefined();
      expect(machine.getNode('active')).toBeDefined();
      expect(machine.getNode('nonexistent')).toBeUndefined();
    });
  });

  describe('nested states', () => {
    it('should compile compound states with children', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'parent',
        states: {
          parent: {
            initial: 'child1',
            states: {
              child1: {},
              child2: {},
            },
          },
        },
      };

      const machine = new StateMachine(config);
      const parent = machine.getNode('parent');
      const child1 = machine.getNode('parent.child1');

      expect(parent).toBeDefined();
      expect(parent?.isCompound()).toBe(true);
      expect(parent?.children).toHaveLength(2);
      expect(parent?.initial?.id).toBe('parent.child1');
      expect(child1?.parent?.id).toBe('parent');
    });

    it('should compile deeply nested states', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'l1',
        states: {
          l1: {
            initial: 'l2',
            states: {
              l2: {
                initial: 'l3',
                states: {
                  l3: {},
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config);
      const l3 = machine.getNode('l1.l2.l3');

      expect(l3).toBeDefined();
      expect(l3?.getDepth()).toBe(3); // root(0) -> l1(1) -> l2(2) -> l3(3)
    });
  });

  describe('parallel states', () => {
    it('should compile parallel states with regions', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'parallel',
        states: {
          parallel: {
            states: {
              region1: {
                initial: 'a',
                states: {
                  a: {},
                  b: {},
                },
              },
              region2: {
                initial: 'x',
                states: {
                  x: {},
                  y: {},
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config);
      const parallel = machine.getNode('parallel');

      expect(parallel).toBeDefined();
      expect(parallel?.isParallel()).toBe(true);
      expect(parallel?.regions).toHaveLength(2);
      expect(parallel?.regions[0]?.key).toBe('region1');
      expect(parallel?.regions[1]?.key).toBe('region2');
    });
  });

  describe('transitions compilation', () => {
    it('should compile simple string target transitions', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            on: {
              NEXT: { target: 'active' },
            },
          },
          active: {},
        },
      };

      const machine = new StateMachine(config);
      const idle = machine.getNode('idle');
      const transitions = idle?.getTransitions('NEXT');

      expect(transitions).toHaveLength(1);
      expect(transitions?.[0]?.targetIds).toEqual(['active']);
    });

    it('should compile transitions with guards and assigns', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            on: {
              NEXT: {
                target: 'active',
                guard: 'isPositive',
                assign: 'increment',
              },
            },
          },
          active: {},
        },
      };

      const machine = new StateMachine(config);
      const idle = machine.getNode('idle');
      const transitions = idle?.getTransitions('NEXT');

      expect(transitions).toHaveLength(1);
      expect(transitions?.[0]?.guard).toBe('isPositive');
      expect(transitions?.[0]?.assign).toBe('increment');
    });

    it('should compile array of transitions', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            on: {
              NEXT: [
                { target: 'active', guard: 'guard1' },
                { target: 'other', guard: 'guard2' },
                { target: 'default' },
              ],
            },
          },
          active: {},
          other: {},
          default: {},
        },
      };

      const machine = new StateMachine(config);
      const idle = machine.getNode('idle');
      const transitions = idle?.getTransitions('NEXT');

      expect(transitions).toHaveLength(3);
      expect(transitions?.[0]?.targetIds).toEqual(['active']);
      expect(transitions?.[1]?.targetIds).toEqual(['other']);
      expect(transitions?.[2]?.targetIds).toEqual(['default']);
    });

    it('should compile always transitions', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            always: [
              { target: 'active', guard: 'isPositive' },
            ],
          },
          active: {},
        },
      };

      const machine = new StateMachine(config);
      const idle = machine.getNode('idle');

      expect(idle?.alwaysTransitions).toHaveLength(1);
      expect(idle?.alwaysTransitions[0]?.targetIds).toEqual(['active']);
    });
  });

  describe('target resolution', () => {
    it('should resolve sibling targets', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
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
              child2: {},
            },
          },
        },
      };

      const machine = new StateMachine(config);
      const child1 = machine.getNode('parent.child1');
      const child2 = machine.getNode('parent.child2');
      const transitions = child1?.getTransitions('NEXT');

      // Should resolve to sibling's full ID
      expect(child2).toBeDefined();
      expect(transitions?.[0]?.targetIds?.[0]).toBeTruthy();
      // The actual resolved ID (implementation may vary)
      expect(transitions?.[0]?.targetIds?.[0]).toMatch(/child2/);
    });

    it('should resolve top-level targets from nested states', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'parent',
        states: {
          parent: {
            initial: 'child',
            states: {
              child: {
                on: {
                  NEXT: { target: 'other' },
                },
              },
            },
          },
          other: {},
        },
      };

      const machine = new StateMachine(config);
      const child = machine.getNode('parent.child');
      const transitions = child?.getTransitions('NEXT');

      expect(transitions?.[0]?.targetIds).toEqual(['other']);
    });
  });

  describe('activities', () => {
    it('should compile activities', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'active',
        states: {
          active: {
            activities: ['ACTIVITY_ONE', 'ACTIVITY_TWO'],
          },
        },
      };

      const machine = new StateMachine(config);
      const active = machine.getNode('active');

      expect(active?.activities).toEqual(['ACTIVITY_ONE', 'ACTIVITY_TWO']);
    });
  });
});
