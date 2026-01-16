/**
 * Example: Parallel State Machine
 * A media player with independent playback and volume controls
 */

import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';

type EdgeCaseContext = {
  logs: string[];
};

type EdgeCaseEvent = { type: 'PING' } | { type: 'RESET' };

export function runEdgeCaseExample() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 2: Edge Cases (Transient, Shadowing, Parallel)');
  console.log('='.repeat(80));

  const config: StateMachineConfig<EdgeCaseContext, EdgeCaseEvent> = {
    initial: 'root',
    initialContext: { logs: [] },
    // We register specific reducers to log every step of the lifecycle
    reducers: {
      // --- Transient Lifecycle Loggers ---
      logEnterParent: ({ context }) => ({ logs: [...context.logs, '1. ENTER Parent'] }),
      logEnterChild: ({ context }) => ({ logs: [...context.logs, '2. ENTER Child'] }),
      logExitChild: ({ context }) => ({ logs: [...context.logs, '3. EXIT Child'] }),
      logExitParent: ({ context }) => ({ logs: [...context.logs, '4. EXIT Parent'] }),
      logArrivedStable: ({ context }) => ({ logs: [...context.logs, '5. ARRIVED Stable'] }),

      // --- Shadowing Loggers ---
      logChildHandled: ({ context }) => ({ logs: [...context.logs, '✅ Child Handled PING'] }),
      logParentHandled: ({ context }) => ({ logs: [...context.logs, '❌ Parent Handled PING (Error: Should be Shadowed!)'] }),
    },
    states: {
      root: {
        type: 'parallel',
        // PARENT HANDLER:
        // In XState, if *any* child handles 'PING', this parent handler must be BLOCKED.
        // If your lib is correct, 'logParentHandled' will NEVER appear in the logs.
        on: {
          PING: { assign: 'logParentHandled' }
        },
        states: {
          // ============================================================
          // REGION 1: THE TRANSIENT YO-YO
          // Tests: onEntry -> nested onEntry -> always -> nested onExit -> onExit
          // ============================================================
          transientRegion: {
            initial: 'transientParent',
            states: {
              transientParent: {
                onEntry: ['logEnterParent'],
                onExit: ['logExitParent'],

                // The "Always" Transition
                // Should trigger immediately after 'transientChild' is fully entered.
                always: [{ target: 'stable' }],

                initial: 'transientChild',
                states: {
                  transientChild: {
                    onEntry: ['logEnterChild'],
                    onExit: ['logExitChild']
                  }
                }
              },
              stable: {
                onEntry: ['logArrivedStable']
              }
            }
          },

          // ============================================================
          // REGION 2: THE ACTIVE CHILD
          // Tests: Child handling event shadows the parent
          // ============================================================
          shadowRegion: {
            initial: 'listening',
            states: {
              listening: {
                on: {
                  PING: { assign: 'logChildHandled' }
                }
              }
            }
          },

          // ============================================================
          // REGION 3: THE SILENT CHILD
          // Tests: Even if this region ignores PING, Region 2 caught it,
          // so Parent still shouldn't fire.
          // ============================================================
          silentRegion: {
            initial: 'idle',
            states: {
              idle: {}
            }
          }
        }
      }
    }
  };

  const machine = new StateMachine(config).start();
  console.log('\n--- Phase 1: Transient Initialization ---');
  // Just by starting, the machine should have drilled down and bubbled up.
  // We expect the logs to show the full entry/exit cycle.
  console.log('Context Logs:', machine.getContext().logs);
}
