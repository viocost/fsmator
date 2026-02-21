import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig, StateContext, BaseEvent } from '../src/types';

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

      const machine = new StateMachine(config).start();
      const root = machine.getRoot();

      expect(root).toBeDefined();
      expect(root.kind).toBe('compound');
      expect(root.children).toHaveLength(2);
      expect(root.initial?.key).toBe('idle');
    });

    it('should register guards and assigns', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        guards: {
          isPositive: ({ context }) => context.count > 0,
        },
        assigns: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
        states: {
          idle: {},
        },
      };

      const machine = new StateMachine(config).start();

      expect(machine.getGuard('isPositive')).toBeDefined();
      expect(machine.getAssign('increment')).toBeDefined();
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

      const machine = new StateMachine(config).start();

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

      const machine = new StateMachine(config).start();
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

      const machine = new StateMachine(config).start();
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

      const machine = new StateMachine(config).start();
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

      const machine = new StateMachine(config).start();
      const idle = machine.getNode('idle');
      const transitions = idle?.getTransitions('NEXT');

      expect(transitions).toHaveLength(1);
      expect(transitions?.[0]?.targetId).toBe('active');
    });

    it('should compile transitions with guards and assigns', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        guards: {
          isPositive: ({ context }) => context.count > 0,
        },
        assigns: {
          increment: ({ context }) => ({ count: context.count + 1 }),
        },
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

      const machine = new StateMachine(config).start();
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
        guards: {
          guard1: ({ context }) => context.count > 0,
          guard2: ({ context }) => context.count > 5,
        },
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

      const machine = new StateMachine(config).start();
      const idle = machine.getNode('idle');
      const transitions = idle?.getTransitions('NEXT');

      expect(transitions).toHaveLength(3);
      expect(transitions?.[0]?.targetId).toBe('active');
      expect(transitions?.[1]?.targetId).toBe('other');
      expect(transitions?.[2]?.targetId).toBe('default');
    });

    it('should compile always transitions', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        guards: {
          isPositive: ({ context }) => context.count > 0,
        },
        states: {
          idle: {
            always: [{ target: 'active', guard: 'isPositive' }],
          },
          active: {},
        },
      };

      const machine = new StateMachine(config).start();
      const idle = machine.getNode('idle');

      expect(idle?.alwaysTransitions).toHaveLength(1);
      expect(idle?.alwaysTransitions[0]?.targetId).toBe('active');
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

      const machine = new StateMachine(config).start();
      const child1 = machine.getNode('parent.child1');
      const child2 = machine.getNode('parent.child2');
      const transitions = child1?.getTransitions('NEXT');

      // Should resolve to sibling's full ID
      expect(child2).toBeDefined();
      expect(transitions?.[0]?.targetId).toBeTruthy();
      // The actual resolved ID (implementation may vary)
      expect(transitions?.[0]?.targetId).toMatch(/child2/);
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

      const machine = new StateMachine(config).start();
      const child = machine.getNode('parent.child');
      const transitions = child?.getTransitions('NEXT');

      expect(transitions?.[0]?.targetId).toBe('other');
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

      const machine = new StateMachine(config).start();
      const active = machine.getNode('active');

      expect(active?.activities).toEqual(['ACTIVITY_ONE', 'ACTIVITY_TWO']);
    });
  });

  describe('validation', () => {
    it('should throw error if guard implementation is missing', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            on: {
              NEXT: {
                target: 'active',
                guard: 'nonExistentGuard', // Guard not defined
              },
            },
          },
          active: {},
        },
      };

      const machine = new StateMachine(config);
      expect(() => machine.start()).toThrow('Missing guard implementation(s): nonExistentGuard');
    });

    it('should throw error if assign implementation is missing', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            on: {
              NEXT: {
                target: 'active',
                assign: 'nonExistentAssign', // Assign not defined
              },
            },
          },
          active: {},
        },
      };

      const machine = new StateMachine(config);
      expect(() => machine.start()).toThrow('Missing assign implementation(s): nonExistentAssign');
    });

    it('should throw error for missing guards in compound guard expressions', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        guards: {
          guardA: ({ context }) => context.count > 0,
          // guardB is missing
        },
        states: {
          idle: {
            on: {
              NEXT: {
                target: 'active',
                guard: { type: 'and', items: ['guardA', 'guardB'] }, // guardB missing
              },
            },
          },
          active: {},
        },
      };

      const machine = new StateMachine(config);
      expect(() => machine.start()).toThrow('Missing guard implementation(s): guardB');
    });

    it('should throw error for missing assigns in entry actions', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            onEntry: ['missingEntryAction'], // Assign not defined
          },
        },
      };

      const machine = new StateMachine(config);
      expect(() => machine.start()).toThrow('Missing assign implementation(s): missingEntryAction');
    });

    it('should throw error for missing assigns in exit actions', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            onExit: ['missingExitAction'], // Assign not defined
          },
          active: {},
        },
      };

      const machine = new StateMachine(config);
      expect(() => machine.start()).toThrow('Missing assign implementation(s): missingExitAction');
    });

    it('should throw error for missing assigns in always transitions', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            always: {
              assign: 'missingAlwaysAssign', // Assign not defined
            },
          },
        },
      };

      const machine = new StateMachine(config);
      expect(() => machine.start()).toThrow(
        'Missing assign implementation(s): missingAlwaysAssign'
      );
    });

    it('should throw error for multiple missing guards', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            on: {
              NEXT: {
                target: 'active',
                guard: 'guardA',
              },
            },
          },
          active: {
            on: {
              PREV: {
                target: 'idle',
                guard: 'guardB',
              },
            },
          },
        },
      };

      const machine = new StateMachine(config);
      expect(() => machine.start()).toThrow('Missing guard implementation(s): guardA, guardB');
    });

    it('should throw error for multiple missing assigns', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        states: {
          idle: {
            onEntry: ['assignA'],
            on: {
              NEXT: {
                target: 'active',
                assign: 'assignB',
              },
            },
          },
          active: {
            onExit: ['assignC'],
          },
        },
      };

      const machine = new StateMachine(config);
      expect(() => machine.start()).toThrow(
        'Missing assign implementation(s): assignA, assignB, assignC'
      );
    });

    it('should not throw error if all guards and assigns are implemented', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        guards: {
          isPositive: ({ context }) => context.count > 0,
        },
        assigns: {
          increment: ({ context }) => ({ count: context.count + 1 }),
          reset: () => ({ count: 0 }),
        },
        states: {
          idle: {
            onEntry: ['reset'],
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
      expect(() => machine.start()).not.toThrow();
    });

    it('should not throw error if all guards and assigns are implemented', () => {
      const config: StateMachineConfig<TestContext, TestEvents> = {
        initialContext: { count: 0 },
        initial: 'idle',
        guards: {
          isPositive: ({ context }) => context.count > 0,
        },
        assigns: {
          increment: ({ context }) => ({ count: context.count + 1 }),
          reset: () => ({ count: 0 }),
        },
        states: {
          idle: {
            onEntry: ['reset'],
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
      expect(() => machine.start()).not.toThrow();
    });
  });
});
