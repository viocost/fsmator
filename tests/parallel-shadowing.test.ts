import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';

/**
 * Tests for parent transition shadowing in parallel states
 *
 * In statecharts, when a child state handles an event, it "shadows" (prevents)
 * parent transitions for that same event from firing. This is standard SCXML behavior.
 *
 * Test coverage:
 * - Parent shadowed when ONE child handles event
 * - Parent shadowed when MULTIPLE children handle event (broadcast)
 * - Parent FIRES when NO children handle event
 * - Nested parallel states shadowing
 * - Mixed scenarios (some regions handle, some don't)
 */

type TestContext = {
  logs: string[];
};

type TestEvent = { type: 'EVENT' } | { type: 'OTHER' };

describe('Parallel State Transition Shadowing', () => {
  describe('Single child handles event', () => {
    it('should shadow parent transition when one child handles event', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initial: 'parallel',
        initialContext: { logs: [] },
        reducers: {
          childA: ({ context }) => ({ logs: [...context.logs, 'childA'] }),
          parent: ({ context }) => ({ logs: [...context.logs, 'parent'] }),
        },
        states: {
          parallel: {
            type: 'parallel',
            on: { EVENT: { assign: 'parent' } },
            states: {
              regionA: {
                initial: 'active',
                states: {
                  active: {
                    on: { EVENT: { assign: 'childA' } },
                  },
                },
              },
              regionB: {
                initial: 'idle',
                states: { idle: {} },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'EVENT' });

      const logs = machine.getContext().logs;
      expect(logs).toEqual(['childA']);
      expect(logs).not.toContain('parent');
    });
  });

  describe('Multiple children handle event', () => {
    it('should shadow parent when multiple children handle event (broadcast)', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initial: 'parallel',
        initialContext: { logs: [] },
        reducers: {
          childA: ({ context }) => ({ logs: [...context.logs, 'childA'] }),
          childB: ({ context }) => ({ logs: [...context.logs, 'childB'] }),
          parent: ({ context }) => ({ logs: [...context.logs, 'parent'] }),
        },
        states: {
          parallel: {
            type: 'parallel',
            on: { EVENT: { assign: 'parent' } },
            states: {
              regionA: {
                initial: 'active',
                states: {
                  active: {
                    on: { EVENT: { assign: 'childA' } },
                  },
                },
              },
              regionB: {
                initial: 'active',
                states: {
                  active: {
                    on: { EVENT: { assign: 'childB' } },
                  },
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'EVENT' });

      const logs = machine.getContext().logs;
      expect(logs).toEqual(['childA', 'childB']);
      expect(logs).not.toContain('parent');
    });

    it('should handle three children all responding to same event', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initial: 'parallel',
        initialContext: { logs: [] },
        reducers: {
          childA: ({ context }) => ({ logs: [...context.logs, 'childA'] }),
          childB: ({ context }) => ({ logs: [...context.logs, 'childB'] }),
          childC: ({ context }) => ({ logs: [...context.logs, 'childC'] }),
          parent: ({ context }) => ({ logs: [...context.logs, 'parent'] }),
        },
        states: {
          parallel: {
            type: 'parallel',
            on: { EVENT: { assign: 'parent' } },
            states: {
              regionA: {
                initial: 'active',
                states: {
                  active: {
                    on: { EVENT: { assign: 'childA' } },
                  },
                },
              },
              regionB: {
                initial: 'active',
                states: {
                  active: {
                    on: { EVENT: { assign: 'childB' } },
                  },
                },
              },
              regionC: {
                initial: 'active',
                states: {
                  active: {
                    on: { EVENT: { assign: 'childC' } },
                  },
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'EVENT' });

      const logs = machine.getContext().logs;
      expect(logs).toEqual(['childA', 'childB', 'childC']);
      expect(logs).not.toContain('parent');
    });
  });

  describe('No children handle event', () => {
    it('should fire parent transition when no children handle event', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initial: 'parallel',
        initialContext: { logs: [] },
        reducers: {
          parent: ({ context }) => ({ logs: [...context.logs, 'parent'] }),
        },
        states: {
          parallel: {
            type: 'parallel',
            on: { EVENT: { assign: 'parent' } },
            states: {
              regionA: {
                initial: 'idle',
                states: { idle: {} },
              },
              regionB: {
                initial: 'idle',
                states: { idle: {} },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'EVENT' });

      const logs = machine.getContext().logs;
      expect(logs).toEqual(['parent']);
    });
  });

  describe('Mixed scenarios', () => {
    it('should shadow parent when some (not all) regions handle event', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initial: 'parallel',
        initialContext: { logs: [] },
        reducers: {
          childA: ({ context }) => ({ logs: [...context.logs, 'childA'] }),
          parent: ({ context }) => ({ logs: [...context.logs, 'parent'] }),
        },
        states: {
          parallel: {
            type: 'parallel',
            on: { EVENT: { assign: 'parent' } },
            states: {
              regionA: {
                initial: 'active',
                states: {
                  active: {
                    on: { EVENT: { assign: 'childA' } },
                  },
                },
              },
              regionB: {
                initial: 'idle',
                states: { idle: {} }, // No handler for EVENT
              },
              regionC: {
                initial: 'idle',
                states: { idle: {} }, // No handler for EVENT
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'EVENT' });

      const logs = machine.getContext().logs;
      expect(logs).toEqual(['childA']);
      expect(logs).not.toContain('parent');
    });

    it('should allow different events to be handled by parent and children', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initial: 'parallel',
        initialContext: { logs: [] },
        reducers: {
          childA: ({ context }) => ({ logs: [...context.logs, 'childA'] }),
          parent: ({ context }) => ({ logs: [...context.logs, 'parent'] }),
        },
        states: {
          parallel: {
            type: 'parallel',
            on: { OTHER: { assign: 'parent' } },
            states: {
              regionA: {
                initial: 'active',
                states: {
                  active: {
                    on: { EVENT: { assign: 'childA' } },
                  },
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'EVENT' });
      expect(machine.getContext().logs).toEqual(['childA']);

      machine.send({ type: 'OTHER' });
      expect(machine.getContext().logs).toEqual(['childA', 'parent']);
    });
  });

  describe('Nested parallel states', () => {
    it('should handle shadowing in nested parallel states', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initial: 'outerParallel',
        initialContext: { logs: [] },
        reducers: {
          outerParent: ({ context }) => ({ logs: [...context.logs, 'outerParent'] }),
          innerParent: ({ context }) => ({ logs: [...context.logs, 'innerParent'] }),
          leaf: ({ context }) => ({ logs: [...context.logs, 'leaf'] }),
        },
        states: {
          outerParallel: {
            type: 'parallel',
            on: { EVENT: { assign: 'outerParent' } },
            states: {
              regionA: {
                initial: 'innerParallel',
                states: {
                  innerParallel: {
                    type: 'parallel',
                    on: { EVENT: { assign: 'innerParent' } },
                    states: {
                      innerRegionA: {
                        initial: 'active',
                        states: {
                          active: {
                            on: { EVENT: { assign: 'leaf' } },
                          },
                        },
                      },
                      innerRegionB: {
                        initial: 'idle',
                        states: { idle: {} },
                      },
                    },
                  },
                },
              },
              regionB: {
                initial: 'idle',
                states: { idle: {} },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'EVENT' });

      const logs = machine.getContext().logs;
      // Leaf handles it, shadowing both inner and outer parents
      expect(logs).toEqual(['leaf']);
      expect(logs).not.toContain('innerParent');
      expect(logs).not.toContain('outerParent');
    });

    it('should fire outer parent when inner parent is shadowed but outer has no handlers', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initial: 'outerParallel',
        initialContext: { logs: [] },
        reducers: {
          innerParent: ({ context }) => ({ logs: [...context.logs, 'innerParent'] }),
          leaf: ({ context }) => ({ logs: [...context.logs, 'leaf'] }),
        },
        states: {
          outerParallel: {
            type: 'parallel',
            states: {
              regionA: {
                initial: 'innerParallel',
                states: {
                  innerParallel: {
                    type: 'parallel',
                    on: { EVENT: { assign: 'innerParent' } },
                    states: {
                      innerRegionA: {
                        initial: 'active',
                        states: {
                          active: {
                            on: { EVENT: { assign: 'leaf' } },
                          },
                        },
                      },
                      innerRegionB: {
                        initial: 'idle',
                        states: { idle: {} },
                      },
                    },
                  },
                },
              },
              regionB: {
                initial: 'idle',
                states: { idle: {} },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'EVENT' });

      const logs = machine.getContext().logs;
      // Leaf handles it, shadows innerParent
      // outerParallel has no transition for EVENT, so nothing else fires
      expect(logs).toEqual(['leaf']);
      expect(logs).not.toContain('innerParent');
    });
  });

  describe('Edge cases', () => {
    it('should handle shadowing with guards on parent', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initial: 'parallel',
        initialContext: { logs: [] },
        guards: {
          alwaysFalse: () => false,
        },
        reducers: {
          child: ({ context }) => ({ logs: [...context.logs, 'child'] }),
          parent: ({ context }) => ({ logs: [...context.logs, 'parent'] }),
        },
        states: {
          parallel: {
            type: 'parallel',
            on: {
              EVENT: { guard: 'alwaysFalse', assign: 'parent' },
            },
            states: {
              regionA: {
                initial: 'active',
                states: {
                  active: {
                    on: { EVENT: { assign: 'child' } },
                  },
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'EVENT' });

      // Child fires, parent's guarded transition would be shadowed anyway
      expect(machine.getContext().logs).toEqual(['child']);
    });

    it('should handle shadowing with guards on children', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initial: 'parallel',
        initialContext: { logs: [] },
        guards: {
          alwaysFalse: () => false,
        },
        reducers: {
          child: ({ context }) => ({ logs: [...context.logs, 'child'] }),
          parent: ({ context }) => ({ logs: [...context.logs, 'parent'] }),
        },
        states: {
          parallel: {
            type: 'parallel',
            on: { EVENT: { assign: 'parent' } },
            states: {
              regionA: {
                initial: 'active',
                states: {
                  active: {
                    on: {
                      EVENT: { guard: 'alwaysFalse', assign: 'child' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'EVENT' });

      // Child's guard fails, so parent fires
      expect(machine.getContext().logs).toEqual(['parent']);
    });

    it('should handle atomic parallel regions', () => {
      const config: StateMachineConfig<TestContext, TestEvent> = {
        initial: 'parallel',
        initialContext: { logs: [] },
        reducers: {
          regionA: ({ context }) => ({ logs: [...context.logs, 'regionA'] }),
          regionB: ({ context }) => ({ logs: [...context.logs, 'regionB'] }),
          parent: ({ context }) => ({ logs: [...context.logs, 'parent'] }),
        },
        states: {
          parallel: {
            type: 'parallel',
            on: { EVENT: { assign: 'parent' } },
            states: {
              regionA: {
                // Atomic region
                on: { EVENT: { assign: 'regionA' } },
              },
              regionB: {
                // Atomic region
                on: { EVENT: { assign: 'regionB' } },
              },
            },
          },
        },
      };

      const machine = new StateMachine(config).start();
      machine.send({ type: 'EVENT' });

      const logs = machine.getContext().logs;
      expect(logs).toEqual(['regionA', 'regionB']);
      expect(logs).not.toContain('parent');
    });
  });
});
