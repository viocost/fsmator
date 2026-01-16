/**
 * Tests for activity tracking and state counters
 */

import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig, ActivityMetadata } from '../src/types';

describe('Activity Tracking', () => {
  describe('State Entry Counters', () => {
    it('should initialize state counters on first entry', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'NEXT' }> = {
        initial: 'idle',
        initialContext: { count: 0 },
        states: {
          idle: {
            activities: ['idleActivity'],
          },
        },
      };

      const machine = new StateMachine(config).start();
      const counters = machine.getStateCounters();

      expect(counters['idle']).toBe(1);
    });

    it('should increment counter on each state entry', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'TOGGLE' }> = {
        initial: 'a',
        initialContext: { count: 0 },
        states: {
          a: {
            activities: ['activityA'],
            on: { TOGGLE: 'b' },
          },
          b: {
            on: { TOGGLE: 'a' },
          },
        },
      };

      const machine = new StateMachine(config).start();

      expect(machine.getStateCounters()['a']).toBe(1);

      machine.send({ type: 'TOGGLE' }); // a → b
      expect(machine.getStateCounters()['b']).toBe(1);

      machine.send({ type: 'TOGGLE' }); // b → a
      expect(machine.getStateCounters()['a']).toBe(2);

      machine.send({ type: 'TOGGLE' }); // a → b
      expect(machine.getStateCounters()['b']).toBe(2);

      machine.send({ type: 'TOGGLE' }); // b → a
      expect(machine.getStateCounters()['a']).toBe(3);
    });

    it('should track counters for nested states independently', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'NEXT' } | { type: 'RESET' }> = {
        initial: 'parent',
        initialContext: { count: 0 },
        states: {
          parent: {
            initial: 'child1',
            activities: ['parentActivity'],
            states: {
              child1: {
                activities: ['child1Activity'],
                on: { NEXT: 'child2' },
              },
              child2: {
                activities: ['child2Activity'],
                on: { NEXT: 'child1' },
              },
            },
            on: { RESET: 'parent' },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // Initial state
      expect(machine.getStateCounters()['parent']).toBe(1);
      expect(machine.getStateCounters()['parent.child1']).toBe(1);

      // Transition child1 → child2
      machine.send({ type: 'NEXT' });
      expect(machine.getStateCounters()['parent']).toBe(1); // Parent not re-entered
      expect(machine.getStateCounters()['parent.child1']).toBe(1);
      expect(machine.getStateCounters()['parent.child2']).toBe(1);

      // Transition child2 → child1
      machine.send({ type: 'NEXT' });
      expect(machine.getStateCounters()['parent']).toBe(1);
      expect(machine.getStateCounters()['parent.child1']).toBe(2); // Re-entered
      expect(machine.getStateCounters()['parent.child2']).toBe(1);

      // Self-transition on parent (exits and re-enters entire hierarchy)
      machine.send({ type: 'RESET' });
      expect(machine.getStateCounters()['parent']).toBe(2); // Re-entered
      expect(machine.getStateCounters()['parent.child1']).toBe(3); // Re-entered again
    });

    it('should track counters for parallel states independently', () => {
      const config: StateMachineConfig<
        { count: number },
        { type: 'TOGGLE_A' } | { type: 'TOGGLE_B' }
      > = {
        initial: 'parallel',
        initialContext: { count: 0 },
        states: {
          parallel: {
            states: {
              regionA: {
                initial: 'a1',
                states: {
                  a1: {
                    activities: ['a1Activity'],
                    on: { TOGGLE_A: 'a2' },
                  },
                  a2: {
                    activities: ['a2Activity'],
                    on: { TOGGLE_A: 'a1' },
                  },
                },
              },
              regionB: {
                initial: 'b1',
                states: {
                  b1: {
                    activities: ['b1Activity'],
                    on: { TOGGLE_B: 'b2' },
                  },
                  b2: {
                    activities: ['b2Activity'],
                    on: { TOGGLE_B: 'b1' },
                  },
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // Initial counters
      expect(machine.getStateCounters()['parallel.regionA.a1']).toBe(1);
      expect(machine.getStateCounters()['parallel.regionB.b1']).toBe(1);

      // Toggle region A only
      machine.send({ type: 'TOGGLE_A' });
      expect(machine.getStateCounters()['parallel.regionA.a2']).toBe(1);
      expect(machine.getStateCounters()['parallel.regionB.b1']).toBe(1); // Unchanged

      // Toggle region B only
      machine.send({ type: 'TOGGLE_B' });
      expect(machine.getStateCounters()['parallel.regionA.a2']).toBe(1); // Unchanged
      expect(machine.getStateCounters()['parallel.regionB.b2']).toBe(1);

      // Toggle both back
      machine.send({ type: 'TOGGLE_A' });
      machine.send({ type: 'TOGGLE_B' });
      expect(machine.getStateCounters()['parallel.regionA.a1']).toBe(2);
      expect(machine.getStateCounters()['parallel.regionB.b1']).toBe(2);
    });
  });

  describe('Activity Instance Tracking', () => {
    it('should return empty array when no activities are defined', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'NEXT' }> = {
        initial: 'idle',
        initialContext: { count: 0 },
        states: {
          idle: {},
        },
      };

      const machine = new StateMachine(config).start();
      const activities = machine.getActiveActivities();

      expect(activities).toEqual([]);
    });

    it('should return active activities with correct metadata', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'NEXT' }> = {
        initial: 'idle',
        initialContext: { count: 0 },
        states: {
          idle: {
            activities: ['fetchData', 'logActivity'],
          },
        },
      };

      const machine = new StateMachine(config).start();
      const activities = machine.getActiveActivities();

      expect(activities).toHaveLength(2);
      expect(activities).toContainEqual({
        type: 'fetchData',
        stateId: 'idle',
        instanceId: 1,
      });
      expect(activities).toContainEqual({
        type: 'logActivity',
        stateId: 'idle',
        instanceId: 1,
      });
    });

    it('should update activity metadata when state is re-entered', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'TOGGLE' }> = {
        initial: 'a',
        initialContext: { count: 0 },
        states: {
          a: {
            activities: ['activityA'],
            on: { TOGGLE: 'b' },
          },
          b: {
            activities: ['activityB'],
            on: { TOGGLE: 'a' },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // Initial state A (instanceId = 1)
      let activities = machine.getActiveActivities();
      expect(activities).toEqual([
        {
          type: 'activityA',
          stateId: 'a',
          instanceId: 1,
        },
      ]);

      // Transition to B
      machine.send({ type: 'TOGGLE' });
      activities = machine.getActiveActivities();
      expect(activities).toEqual([
        {
          type: 'activityB',
          stateId: 'b',
          instanceId: 1,
        },
      ]);

      // Transition back to A (instanceId = 2)
      machine.send({ type: 'TOGGLE' });
      activities = machine.getActiveActivities();
      expect(activities).toEqual([
        {
          type: 'activityA',
          stateId: 'a',
          instanceId: 2,
        },
      ]);
    });

    it('should track activities in nested states', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'NEXT' }> = {
        initial: 'parent',
        initialContext: { count: 0 },
        states: {
          parent: {
            initial: 'child',
            activities: ['parentActivity'],
            states: {
              child: {
                activities: ['childActivity'],
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      const activities = machine.getActiveActivities();

      expect(activities).toHaveLength(2);
      expect(activities).toContainEqual({
        type: 'parentActivity',
        stateId: 'parent',
        instanceId: 1,
      });
      expect(activities).toContainEqual({
        type: 'childActivity',
        stateId: 'parent.child',
        instanceId: 1,
      });
    });

    it('should track activities in parallel states', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'NEXT' }> = {
        initial: 'parallel',
        initialContext: { count: 0 },
        states: {
          parallel: {
            states: {
              regionA: {
                initial: 'a1',
                states: {
                  a1: {
                    activities: ['activityA1'],
                  },
                },
              },
              regionB: {
                initial: 'b1',
                states: {
                  b1: {
                    activities: ['activityB1'],
                  },
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      const activities = machine.getActiveActivities();

      expect(activities).toHaveLength(2);
      expect(activities).toContainEqual({
        type: 'activityA1',
        stateId: 'parallel.regionA.a1',
        instanceId: 1,
      });
      expect(activities).toContainEqual({
        type: 'activityB1',
        stateId: 'parallel.regionB.b1',
        instanceId: 1,
      });
    });
  });

  describe('Activity Relevance Checking', () => {
    it('should return true for relevant activity', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'NEXT' }> = {
        initial: 'idle',
        initialContext: { count: 0 },
        states: {
          idle: {
            activities: ['fetchData'],
          },
        },
      };

      const machine = new StateMachine(config).start();

      const metadata: ActivityMetadata = {
        type: 'fetchData',
        stateId: 'idle',
        instanceId: 1,
      };

      expect(machine.isActivityRelevant(metadata)).toBe(true);
    });

    it('should return false for activity with wrong counter', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'TOGGLE' }> = {
        initial: 'a',
        initialContext: { count: 0 },
        states: {
          a: {
            activities: ['activityA'],
            on: { TOGGLE: 'b' },
          },
          b: {
            on: { TOGGLE: 'a' },
          },
        },
      };

      const machine = new StateMachine(config).start();

      // Save activity from first entry
      const oldActivity: ActivityMetadata = {
        type: 'activityA',
        stateId: 'a',
        instanceId: 1,
      };

      // Transition away and back
      machine.send({ type: 'TOGGLE' }); // a → b
      machine.send({ type: 'TOGGLE' }); // b → a (counter now 2)

      // Old activity should no longer be relevant
      expect(machine.isActivityRelevant(oldActivity)).toBe(false);

      // New activity should be relevant
      const newActivity: ActivityMetadata = {
        type: 'activityA',
        stateId: 'a',
        instanceId: 2,
      };
      expect(machine.isActivityRelevant(newActivity)).toBe(true);
    });

    it('should return false for activity in inactive state', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'NEXT' }> = {
        initial: 'a',
        initialContext: { count: 0 },
        states: {
          a: {
            activities: ['activityA'],
            on: { NEXT: 'b' },
          },
          b: {
            activities: ['activityB'],
          },
        },
      };

      const machine = new StateMachine(config).start();

      const activityA: ActivityMetadata = {
        type: 'activityA',
        stateId: 'a',
        instanceId: 1,
      };

      expect(machine.isActivityRelevant(activityA)).toBe(true);

      machine.send({ type: 'NEXT' }); // a → b

      expect(machine.isActivityRelevant(activityA)).toBe(false);
    });
  });

  describe('Activity Instance Identifiers', () => {
    it('should generate correct instance identifier', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'NEXT' }> = {
        initial: 'idle',
        initialContext: { count: 0 },
        states: {
          idle: {
            activities: ['fetchData'],
          },
        },
      };

      const machine = new StateMachine(config).start();

      const metadata: ActivityMetadata = {
        type: 'fetchData',
        stateId: 'idle',
        instanceId: 1,
      };

      expect(machine.getActivityInstance(metadata)).toBe('idle_1');
    });

    it('should generate unique identifiers for different entries', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'TOGGLE' }> = {
        initial: 'a',
        initialContext: { count: 0 },
        states: {
          a: {
            activities: ['activityA'],
            on: { TOGGLE: 'b' },
          },
          b: {
            on: { TOGGLE: 'a' },
          },
        },
      };

      const machine = new StateMachine(config).start();

      const instance1 = machine.getActivityInstance({
        type: 'activityA',
        stateId: 'a',
        instanceId: 1,
      });

      machine.send({ type: 'TOGGLE' }); // a → b
      machine.send({ type: 'TOGGLE' }); // b → a (counter = 2)

      const instance2 = machine.getActivityInstance({
        type: 'activityA',
        stateId: 'a',
        instanceId: 2,
      });

      expect(instance1).toBe('a_1');
      expect(instance2).toBe('a_2');
      expect(instance1).not.toBe(instance2);
    });

    it('should generate identifiers for nested state activities', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'NEXT' }> = {
        initial: 'parent',
        initialContext: { count: 0 },
        states: {
          parent: {
            initial: 'child',
            states: {
              child: {
                activities: ['childActivity'],
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();

      const metadata: ActivityMetadata = {
        type: 'childActivity',
        stateId: 'parent.child',
        instanceId: 1,
      };

      expect(machine.getActivityInstance(metadata)).toBe('parent.child_1');
    });
  });

  describe('Snapshot and Restore', () => {
    it('should include state counters in snapshot', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'TOGGLE' }> = {
        initial: 'a',
        initialContext: { count: 0 },
        states: {
          a: {
            on: { TOGGLE: 'b' },
          },
          b: {
            on: { TOGGLE: 'a' },
          },
        },
      };

      const machine = new StateMachine(config).start();

      machine.send({ type: 'TOGGLE' }); // a → b
      machine.send({ type: 'TOGGLE' }); // b → a

      const snapshot = machine.getSnapshot();

      expect(snapshot.stateCounters).toEqual({
        a: 2,
        b: 1,
      });
    });

    it('should restore state counters from snapshot', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'TOGGLE' }> = {
        initial: 'a',
        initialContext: { count: 5 },
        states: {
          a: {
            activities: ['activityA'],
            on: { TOGGLE: 'b' },
          },
          b: {
            activities: ['activityB'],
            on: { TOGGLE: 'a' },
          },
        },
      };

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'TOGGLE' }); // a → b
      machine1.send({ type: 'TOGGLE' }); // b → a
      machine1.send({ type: 'TOGGLE' }); // a → b

      const snapshot = machine1.getSnapshot();

      // Create new machine from snapshot
      const machine2 = new StateMachine(config).load(snapshot);

      expect(machine2.getStateCounters()).toEqual(snapshot.stateCounters);
      expect(machine2.getContext()).toEqual(snapshot.context);
      expect(Array.from(machine2.getActiveStateNodes())).toEqual(snapshot.configuration);
    });

    it('should maintain activity relevance after restore', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'TOGGLE' }> = {
        initial: 'a',
        initialContext: { count: 0 },
        states: {
          a: {
            activities: ['activityA'],
            on: { TOGGLE: 'b' },
          },
          b: {
            activities: ['activityB'],
            on: { TOGGLE: 'a' },
          },
        },
      };

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'TOGGLE' }); // a → b

      const snapshot = machine1.getSnapshot();
      const activities1 = machine1.getActiveActivities();

      // Restore to new machine
      const machine2 = new StateMachine(config).load(snapshot);
      const activities2 = machine2.getActiveActivities();

      expect(activities2).toEqual(activities1);
      expect(activities2).toEqual([
        {
          type: 'activityB',
          stateId: 'b',
          instanceId: 1,
        },
      ]);
    });

    it('should continue incrementing counters after restore', () => {
      const config: StateMachineConfig<{ count: number }, { type: 'TOGGLE' }> = {
        initial: 'a',
        initialContext: { count: 0 },
        states: {
          a: {
            on: { TOGGLE: 'b' },
          },
          b: {
            on: { TOGGLE: 'a' },
          },
        },
      };

      const machine1 = new StateMachine(config).start();
      machine1.send({ type: 'TOGGLE' }); // a → b
      machine1.send({ type: 'TOGGLE' }); // b → a (a counter = 2)

      const snapshot = machine1.getSnapshot();

      // Restore and continue
      const machine2 = new StateMachine(config).load(snapshot).start();
      machine2.send({ type: 'TOGGLE' }); // a → b (b counter = 2)
      machine2.send({ type: 'TOGGLE' }); // b → a (a counter = 3)

      expect(machine2.getStateCounters()['a']).toBe(3);
      expect(machine2.getStateCounters()['b']).toBe(2);
    });
  });
});
