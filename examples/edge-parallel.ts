import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';

type EdgeCaseContext = {
  logs: string[];
};

type EdgeCaseEvent = { type: 'PING' } | { type: 'MULTI_FIRE' };

export function runParallelEdgeCaseExample() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 3: Parallel Broadcast & Parent Shadowing');
  console.log('='.repeat(80));

  const config: StateMachineConfig<EdgeCaseContext, EdgeCaseEvent> = {
    initial: 'root',
    initialContext: { logs: [] },
    reducers: {
      // Broadcast Loggers
      logRegionA: ({ context }) => ({ logs: [...context.logs, '✅ Region A caught it'] }),
      logRegionB: ({ context }) => ({ logs: [...context.logs, '✅ Region B caught it'] }),
      logParent: ({ context }) => ({ logs: [...context.logs, '❌ PARENT fired (Error: Should be shadowed!)'] }),
    },
    states: {
      root: {
        type: 'parallel',
        // PARENT HANDLER
        // This should NEVER fire if any child handles the event.
        on: {
          MULTI_FIRE: { assign: 'logParent' }
        },
        states: {
          // REGION A: Handles the event
          regionA: {
            initial: 'active',
            states: {
              active: {
                on: {
                  MULTI_FIRE: { assign: 'logRegionA' }
                }
              }
            }
          },

          // REGION B: ALSO Handles the event
          // In a parallel state, siblings do NOT block each other.
          regionB: {
            initial: 'active',
            states: {
              active: {
                on: {
                  MULTI_FIRE: { assign: 'logRegionB' }
                }
              }
            }
          },

          // REGION C: Ignores the event
          // Just to prove partial handling works
          regionC: {
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

  console.log('\n--- Sending MULTI_FIRE Event ---');
  machine.send({ type: 'MULTI_FIRE' });

  const logs = machine.getContext().logs;
  console.log('Logs:', logs);

  // --- VERIFICATION ---
  const regionAFired = logs.includes('✅ Region A caught it');
  const regionBFired = logs.includes('✅ Region B caught it');
  const parentFired = logs.includes('❌ PARENT fired (Error: Should be shadowed!)');

  console.log('\n--- Test Results ---');
  console.log(`Region A Fired: ${regionAFired ? 'PASS' : 'FAIL'}`);
  console.log(`Region B Fired: ${regionBFired ? 'PASS' : 'FAIL'}`);
  console.log(`Parent BLOCKED: ${!parentFired ? 'PASS' : 'FAIL'}`);

  if (regionAFired && regionBFired && !parentFired) {
    console.log('\n🎉 SUCCESS: Parallel broadcast works and Parent is shadowed.');
  } else {
    console.log('\n🔥 FAILURE: Check your event propagation logic.');
  }
}
