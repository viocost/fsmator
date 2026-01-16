/**
 * Examples Index
 * Run all examples demonstrating state-reducer features
 *
 * Usage: npx tsx examples/index.ts
 */

import { runFlatMachineExample } from './flat-machine.example';
import { runNestedMachineExample } from './nested-machine.example';
//import { runParallelMachineExample } from './parallel-machine.example';
import { runContextChangesExample } from './context-changes.example';
import { runGuardConditionsExample } from './guard-conditions.example';
import { runEdgeCaseExample } from './parallel-machine.example';
import { runParallelEdgeCaseExample } from './edge-parallel';

console.log('╔' + '═'.repeat(78) + '╗');
console.log('║' + ' '.repeat(20) + 'STATE REDUCER EXAMPLES' + ' '.repeat(35) + '║');
console.log('╚' + '═'.repeat(78) + '╝');

// Run all examples
//runFlatMachineExample();
// runEdgeCaseExample()
runParallelEdgeCaseExample();
// runNestedMachineExample();
// runParallelMachineExample();
// runContextChangesExample();
// runGuardConditionsExample();

console.log('\n' + '='.repeat(80));
console.log('All examples completed!');
console.log('='.repeat(80));
