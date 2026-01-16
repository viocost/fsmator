/**
 * StateMachine class - orchestrates the state machine
 * Holds the root node, manages guards/reducers registry, compiles configuration
 */

import { StateNode, NodeKind, NodeTransition } from './state-node';
import type {
  StateContext,
  BaseEvent,
  StateMachineConfig,
  Guard,
  Reducer,
  StateConfig,
  GuardRef,
  ActivityMetadata,
  StateCountersSnapshot,
  MachineSnapshot,
  StateValue,
} from './types';

/**
 * StateMachine class
 */
export class StateMachine<Context extends StateContext, Event extends BaseEvent> {
  private root: StateNode;
  private context: Context;
  private configuration: Set<string> = new Set();
  private debugEnabled: boolean = false;
  private started: boolean = false;
  private loaded: boolean = false;
  private halted: boolean = false;

  // State entry counters for activity tracking
  private stateEntryCounters: Map<string, number> = new Map();

  // Time travel history
  private timeTravelEnabled: boolean = false;
  private history: MachineSnapshot<Context>[] = [];
  private historyIndex: number = -1; // Current position in history (-1 = no history yet)

  // Registries
  private guards: Map<string | symbol, Guard<Context, Event>> = new Map();
  private reducers: Map<string | symbol, Reducer<Context, Event>> = new Map();

  // Node lookup by ID
  private nodesById: Map<string, StateNode> = new Map();

  constructor(config: StateMachineConfig<Context, Event>) {
    this.context = config.initialContext;
    this.debugEnabled = config.debug ?? false;
    this.timeTravelEnabled = config.timeTravel ?? false;

    // Register guards and reducers
    if (config.guards) {
      for (const [key, guard] of Object.entries(config.guards)) {
        this.guards.set(key, guard);
      }
    }
    if (config.reducers) {
      for (const [key, reducer] of Object.entries(config.reducers)) {
        this.reducers.set(key, reducer);
      }
    }

    // Compile the state tree
    this.root = this.compileTree(config);

    // Second pass: resolve all target IDs now that all nodes exist
    this.resolveAllTargets();
  }

  /**
   * Start the state machine by activating initial states or evaluating always transitions after load
   * Must be called before sending events
   * @returns this for chaining
   */
  start(): this {
    if (this.started) {
      throw new Error('State machine already started');
    }

    this.log('🚀 Starting state machine');

    if (this.loaded) {
      // If loaded from snapshot, just evaluate always transitions and mark as started
      const loadEvent = { type: '__load__' } as Event;
      this.evaluateAlwaysTransitions(loadEvent);
      this.checkFinalStates();
    } else {
      // Fresh start - initialize from initial state
      this.initialize();
    }

    this.started = true;

    // Capture initial state to history
    this.captureHistory();

    return this;
  }

  /**
   * Load a snapshot and restore machine state
   * Performs sanity checks to ensure snapshot is valid for current schema
   * Must call start() after load() to begin processing events
   * @param snapshot - The snapshot to load
   * @returns this for chaining
   */
  load(snapshot: MachineSnapshot<Context>): this {
    if (this.started) {
      throw new Error('Cannot load snapshot on already started machine');
    }

    this.log('📥 Loading snapshot');

    // Validate that all states in configuration exist in schema
    for (const stateId of snapshot.configuration) {
      const node = this.nodesById.get(stateId);
      if (!node) {
        throw new Error(`Invalid snapshot: state "${stateId}" not found in schema`);
      }
    }

    // Validate that configuration is valid (all atomic states are active)
    const configSet = new Set(snapshot.configuration);

    // Check that we have at least one state
    if (configSet.size === 0) {
      throw new Error('Invalid snapshot: configuration is empty');
    }

    // Restore context
    this.context = snapshot.context;

    // Restore state entry counters
    if (snapshot.stateCounters) {
      for (const [stateId, counter] of Object.entries(snapshot.stateCounters)) {
        // Validate state exists
        if (!this.nodesById.has(stateId)) {
          throw new Error(
            `Invalid snapshot: state "${stateId}" in stateCounters not found in schema`
          );
        }
        this.stateEntryCounters.set(stateId, counter);
      }
    }

    // Restore configuration (but don't mark as started yet)
    this.configuration = configSet;
    this.loaded = true;

    this.log('✅ Snapshot loaded:', {
      configuration: Array.from(this.configuration),
      context: this.context,
    });

    return this;
  }

  /**
   * Dump current machine state as a serialized JSON snapshot
   * Can be used to persist and restore machine state
   * @returns JSON string containing the snapshot
   */
  dump(): string {
    if (this.configuration.size === 0) {
      throw new Error('Cannot dump: machine not started');
    }

    const snapshot: MachineSnapshot<Context> = {
      context: this.context,
      configuration: Array.from(this.configuration),
      stateCounters: this.getStateCounters(),
    };

    return JSON.stringify(snapshot);
  }

  /**
   * Get the root node
   */
  getRoot(): StateNode {
    return this.root;
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): StateNode | undefined {
    return this.nodesById.get(id);
  }

  /**
   * Get all node IDs
   */
  getNodeIds(): string[] {
    return Array.from(this.nodesById.keys());
  }

  /**
   * Get guard function
   */
  getGuard(id: string | symbol): Guard<Context, Event> | undefined {
    return this.guards.get(id);
  }

  /**
   * Get reducer function
   */
  getReducer(id: string | symbol): Reducer<Context, Event> | undefined {
    return this.reducers.get(id);
  }

  /**
   * Get current context
   */
  getContext(): Context {
    return this.context;
  }

  /**
   * Get current configuration (set of active node IDs)
   */
  getActiveStateNodes(): ReadonlySet<string> {
    return this.configuration;
  }

  /**
   * Get current state value in XState-compatible format
   * - Atomic states: returns string (e.g., "idle")
   * - Compound states: returns nested object (e.g., { form: "editing" })
   * - Parallel states: returns object with all regions (e.g., { playback: "playing", volume: "muted" })
   */
  getStateValue(): StateValue {
    // Start from root and build state value
    return this.buildStateValue(this.root, false);
  }

  /**
   * Build state value recursively from a node
   * @param node - The node to build value for
   * @param skipKey - Whether to skip wrapping with node key (for parallel regions)
   */
  private buildStateValue(node: StateNode, skipKey: boolean): StateValue {
    // For root, return value of first active child
    if (node === this.root) {
      const activeChild = node.children.find((child) => this.configuration.has(child.id));
      if (!activeChild) {
        throw new Error('No active state found');
      }
      return this.buildStateValue(activeChild, false);
    }

    // For atomic states
    if (node.isAtomic()) {
      // If skipKey is true (parallel region), return empty object
      // Otherwise, return just the key
      return skipKey ? {} : node.key;
    }

    // For compound states, find the active child
    if (node.isCompound()) {
      const activeChild = node.children.find((child) => this.configuration.has(child.id));
      if (!activeChild) {
        // If no child is active, return just the key (edge case)
        return node.key;
      }
      const childValue = this.buildStateValue(activeChild, false);

      // If this is a parallel region, return child value directly without wrapping
      if (skipKey) {
        return childValue;
      }

      return { [node.key]: childValue };
    }

    // For parallel states, return all active regions
    if (node.isParallel()) {
      const result: Record<string, StateValue> = {};
      for (const region of node.regions) {
        // Check if the region itself is active
        if (this.configuration.has(region.id)) {
          // Build value for region with skipKey=true so it doesn't wrap itself
          result[region.key] = this.buildStateValue(region, true);
        }
      }

      // If this parallel node is itself a parallel region, return regions directly
      if (skipKey) {
        return result;
      }

      return { [node.key]: result };
    }

    // Fallback
    return node.key;
  }

  /**
   * Check if the machine is in a final state (halted)
   */
  isHalted(): boolean {
    return this.halted;
  }

  /**
   * Check if any active atomic state is a final state
   * If so, mark the machine as halted
   */
  private checkFinalStates(): void {
    // Check all active atomic states
    for (const stateId of this.configuration) {
      const node = this.nodesById.get(stateId);
      if (node && node.kind === 'atomic' && node.final) {
        this.halted = true;
        this.log(`⏹️  Machine halted: reached final state "${stateId}"`);
        return;
      }
    }
  }

  /**
   * Capture current state to history (for time travel)
   * Called after every transition when timeTravel is enabled
   */
  private captureHistory(): void {
    if (!this.timeTravelEnabled) {
      return;
    }

    const snapshot = this.getSnapshot();

    // If we're not at the end of history, truncate everything after current position
    // This happens when we rewind and then send new events (branching)
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.log('🌿 History branched - truncated future history');
    }

    // Add new snapshot
    this.history.push(snapshot);
    this.historyIndex = this.history.length - 1;

    this.log(`📸 History captured (index: ${this.historyIndex}, total: ${this.history.length})`);
  }

  /**
   * Restore machine state from a history snapshot
   * @param snapshot - The snapshot to restore
   */
  private restoreFromSnapshot(snapshot: MachineSnapshot<Context>): void {
    this.context = snapshot.context;
    this.configuration = new Set(snapshot.configuration);

    // Restore state entry counters
    this.stateEntryCounters.clear();
    for (const [stateId, counter] of Object.entries(snapshot.stateCounters)) {
      this.stateEntryCounters.set(stateId, counter);
    }

    // Check if we're in a final state
    this.halted = false; // Reset first
    this.checkFinalStates();
  }

  /**
   * Rewind history by the specified number of steps
   * @param steps - Number of steps to rewind (default: 1)
   * @returns this for chaining
   */
  rewind(steps: number = 1): this {
    if (!this.timeTravelEnabled) {
      throw new Error('Time travel not enabled. Set timeTravel: true in config.');
    }

    if (!this.started) {
      throw new Error('Cannot rewind: machine not started.');
    }

    if (this.history.length === 0) {
      throw new Error('Cannot rewind: no history available.');
    }

    // Calculate target index
    const targetIndex = Math.max(0, this.historyIndex - steps);
    const actualSteps = this.historyIndex - targetIndex;

    if (actualSteps === 0) {
      this.log('⏪ Already at the beginning of history');
      return this;
    }

    this.log(`⏪ Rewinding ${actualSteps} step(s) (from ${this.historyIndex} to ${targetIndex})`);

    // Restore state from history
    this.historyIndex = targetIndex;
    const snapshot = this.history[this.historyIndex];
    if (!snapshot) {
      throw new Error(`Invalid history state at index ${this.historyIndex}`);
    }
    this.restoreFromSnapshot(snapshot);

    this.log(`✅ Rewound to history index ${this.historyIndex}`);
    return this;
  }

  /**
   * Fast-forward history by the specified number of steps
   * @param steps - Number of steps to fast-forward (default: 1)
   * @returns this for chaining
   */
  ff(steps: number = 1): this {
    if (!this.timeTravelEnabled) {
      throw new Error('Time travel not enabled. Set timeTravel: true in config.');
    }

    if (!this.started) {
      throw new Error('Cannot fast-forward: machine not started.');
    }

    if (this.history.length === 0) {
      throw new Error('Cannot fast-forward: no history available.');
    }

    // Calculate target index
    const targetIndex = Math.min(this.history.length - 1, this.historyIndex + steps);
    const actualSteps = targetIndex - this.historyIndex;

    if (actualSteps === 0) {
      this.log('⏩ Already at the end of history');
      return this;
    }

    this.log(
      `⏩ Fast-forwarding ${actualSteps} step(s) (from ${this.historyIndex} to ${targetIndex})`
    );

    // Restore state from history
    this.historyIndex = targetIndex;
    const snapshot = this.history[this.historyIndex];
    if (!snapshot) {
      throw new Error(`Invalid history state at index ${this.historyIndex}`);
    }
    this.restoreFromSnapshot(snapshot);

    this.log(`✅ Fast-forwarded to history index ${this.historyIndex}`);
    return this;
  }

  /**
   * Get current history index (for debugging/testing)
   */
  getHistoryIndex(): number {
    return this.historyIndex;
  }

  /**
   * Get history length (for debugging/testing)
   */
  getHistoryLength(): number {
    return this.history.length;
  }

  /**
   * Get state entry counters snapshot (for serialization)
   *
   * Note: Internally we track state entry counters, but externally in ActivityMetadata
   * we expose this as instanceId for clarity.
   */
  getStateCounters(): StateCountersSnapshot {
    const snapshot: StateCountersSnapshot = {};
    for (const [stateId, counter] of this.stateEntryCounters.entries()) {
      snapshot[stateId] = counter;
    }
    return snapshot;
  }

  /**
   * Get machine snapshot including context, configuration, and state entry counters
   */
  getSnapshot(): MachineSnapshot<Context> {
    return {
      context: this.context,
      configuration: Array.from(this.configuration),
      stateCounters: this.getStateCounters(),
    };
  }

  /**
   * Check if an activity instance is relevant (currently active)
   *
   * An activity is relevant if:
   * 1. The state where it's defined is currently active
   * 2. The state's current entry counter matches the activity's instanceId
   *
   * @param metadata - Activity metadata with type, stateId, and instanceId
   * @returns true if the activity instance is currently relevant
   */
  isActivityRelevant(metadata: ActivityMetadata): boolean {
    // Check if the state is currently active
    if (!this.configuration.has(metadata.stateId)) {
      return false;
    }

    // Check if the entry counter matches the activity's instanceId
    const currentCounter = this.stateEntryCounters.get(metadata.stateId) ?? 0;
    return currentCounter === metadata.instanceId;
  }

  /**
   * Get all currently active activities with their instance identifiers
   *
   * Note: Returns instanceId (external API) which corresponds to the state's entry counter
   *
   * @returns Array of activity metadata for all active activities
   */
  getActiveActivities(): ActivityMetadata[] {
    const activities: ActivityMetadata[] = [];

    // Iterate through all active states
    for (const stateId of this.configuration) {
      const node = this.nodesById.get(stateId);
      if (!node) continue;

      const entryCounter = this.stateEntryCounters.get(stateId) ?? 0;

      // Get activities for this state
      for (const activityType of node.activities) {
        activities.push({
          type: activityType,
          stateId: stateId,
          instanceId: entryCounter, // External API uses instanceId
        });
      }
    }

    return activities;
  }

  /**
   * Get activity instance identifier
   * Format: {stateId}_{instanceId}
   *
   * @param metadata - Activity metadata
   * @returns Instance identifier string
   */
  getActivityInstance(metadata: ActivityMetadata): string {
    return `${metadata.stateId}_${metadata.instanceId}`;
  }

  /**
   * Log debug message if debug mode is enabled
   */
  private log(message: string, ...args: any[]): void {
    if (this.debugEnabled) {
      console.log(message, ...args);
    }
  }

  /**
   * Execute a reducer by reference and return updated context (pure)
   */
  private executeReducer(
    reducerRef: string | symbol,
    context: Context,
    event: Event,
    state: string
  ): Context {
    const reducer = this.getReducer(reducerRef);
    if (!reducer) {
      throw new Error(`Reducer "${String(reducerRef)}" not found`);
    }
    this.log(`   ⚙️  Executing reducer: ${String(reducerRef)}`);
    const updates = reducer({ context, event, state });
    const newContext = { ...context, ...updates };

    // Log context changes
    if (this.debugEnabled && Object.keys(updates).length > 0) {
      this.log(`      Context updates:`, updates);
    }

    return newContext;
  }

  /**
   * Execute multiple reducers in sequence (pure)
   */
  private executeReducers(
    reducerRefs: ReadonlyArray<string | symbol>,
    context: Context,
    event: Event,
    state: string
  ): Context {
    let newContext = context;
    for (const ref of reducerRefs) {
      newContext = this.executeReducer(ref, newContext, event, state);
    }
    return newContext;
  }

  /**
   * Initialize the state machine by activating initial states
   */
  private initialize(): void {
    this.log('🚀 Initializing state machine');

    // Create a synthetic initialization event
    const initEvent = { type: '__init__' } as Event;

    // Start from root's initial state
    const initialState = this.root.initial;
    if (!initialState) {
      throw new Error('Root node must have an initial state');
    }

    // Activate the initial state and get updated context
    const newConfig = new Set<string>();
    this.context = this.activateState(initialState, initEvent, this.context, newConfig);
    this.configuration = newConfig;

    this.log('✅ Initial configuration:', Array.from(this.configuration));

    // Evaluate always transitions after initialization
    this.evaluateAlwaysTransitions(initEvent);

    // Check if we've reached a final state
    this.checkFinalStates();
  }

  /**
   * Second pass: resolve all target IDs now that all nodes exist
   */
  private resolveAllTargets(): void {
    // Iterate through all nodes and resolve their transition targets
    for (const node of this.nodesById.values()) {
      // Resolve on transitions
      for (const [_eventType, transitions] of (node as any)._onTransitions.entries()) {
        for (const transition of transitions) {
          if (transition.targetIds) {
            transition.targetIds = transition.targetIds.map((targetId: string) => {
              // If already resolved (contains dot or exists in nodesById), keep it
              if (targetId.includes('.') || this.nodesById.has(targetId)) {
                return targetId;
              }
              // Otherwise, resolve from this node's context
              return this.resolveTargetId(targetId, node);
            });
          }
        }
      }

      // Resolve always transitions
      for (const transition of node.alwaysTransitions) {
        if (transition.targetIds) {
          (transition as any).targetIds = transition.targetIds.map((targetId: string) => {
            if (targetId.includes('.') || this.nodesById.has(targetId)) {
              return targetId;
            }
            return this.resolveTargetId(targetId, node);
          });
        }
      }
    }
  }

  /**
   * Activate a state node (pure function)
   * Algorithm:
   * 1. Increment state entry counter
   * 2. Execute onEntry actions
   * 3. Activate children recursively based on node kind
   * 4. Add node to configuration
   *
   * @param node - The state node to activate
   * @param event - The current event
   * @param context - Current context
   * @param config - Configuration set to update
   * @param followChildren - Whether to follow initial children (default: true)
   * @returns Updated context
   */
  private activateState(
    node: StateNode,
    event: Event,
    context: Context,
    config: Set<string>,
    followChildren: boolean = true
  ): Context {
    // Increment state entry counter
    const currentCounter = this.stateEntryCounters.get(node.id) ?? 0;
    this.stateEntryCounters.set(node.id, currentCounter + 1);

    this.log(`➡️  Entering state: ${node.id} (entry #${currentCounter + 1})`);

    // Step 1: Execute onEntry actions
    let newContext = this.executeReducers(node.onEntry, context, event, node.id);

    // Step 2: Activate children recursively based on node kind (if followChildren)
    if (followChildren) {
      if (node.isAtomic()) {
        // Atomic nodes have no children to activate
      } else if (node.isCompound()) {
        // Compound nodes: activate the initial child
        const initial = node.initial;
        if (initial) {
          newContext = this.activateState(initial, event, newContext, config, true);
        }
      } else if (node.isParallel()) {
        // Parallel nodes: activate all region children
        for (const region of node.regions) {
          newContext = this.activateState(region, event, newContext, config, true);
        }
      }
    }

    // Step 3: Add this node to active configuration
    config.add(node.id);

    return newContext;
  }

  /**
   * Deactivate a state node (pure function)
   * Executes onExit actions and removes from configuration
   *
   * @param node - The state node to deactivate
   * @param event - The current event
   * @param context - Current context
   * @returns Updated context
   */
  private deactivateState(node: StateNode, event: Event, context: Context): Context {
    this.log(`⬅️  Exiting state: ${node.id}`);

    // Execute onExit actions
    return this.executeReducers(node.onExit, context, event, node.id);
  }

  /**
   * Find the Least Common Ancestor of two nodes
   */
  private findLCA(node1: StateNode, node2: StateNode): StateNode {
    const ancestors1 = node1.getAncestors();
    const ancestors2 = node2.getAncestors();

    // Build a set of ancestors for node1 for O(1) lookup
    const ancestors1Set = new Set(ancestors1);

    // Find first common ancestor from node2's chain
    for (const ancestor of ancestors2) {
      if (ancestors1Set.has(ancestor)) {
        return ancestor;
      }
    }

    // Should never reach here if both nodes are in the same tree
    return this.root;
  }

  /**
   * Get all atomic (leaf) nodes that are currently active
   */
  private getActiveAtomicNodes(config: Set<string>): StateNode[] {
    const atomicNodes: StateNode[] = [];

    for (const nodeId of config) {
      const node = this.nodesById.get(nodeId);
      if (node && node.isAtomic()) {
        atomicNodes.push(node);
      }
    }

    return atomicNodes;
  }

  /**
   * Evaluate a guard reference (handles and/or/not logic)
   */
  private evaluateGuard(
    guardRef: GuardRef,
    context: Context,
    event: Event,
    state: string
  ): boolean {
    if (typeof guardRef === 'string' || typeof guardRef === 'symbol') {
      const guard = this.getGuard(guardRef);
      if (!guard) {
        throw new Error(`Guard "${String(guardRef)}" not found`);
      }
      const result = guard({ context, event, state });
      this.log(`   🛡️  Guard "${String(guardRef)}": ${result ? 'PASS' : 'FAIL'}`);
      return result;
    }

    if (typeof guardRef === 'object' && 'type' in guardRef) {
      if (guardRef.type === 'ref') {
        const guard = this.getGuard(guardRef.id);
        if (!guard) {
          throw new Error(`Guard "${String(guardRef.id)}" not found`);
        }
        const result = guard({ context, event, state });
        this.log(`   🛡️  Guard "${String(guardRef.id)}": ${result ? 'PASS' : 'FAIL'}`);
        return result;
      }

      if (guardRef.type === 'and') {
        this.log(`   🛡️  Evaluating AND guard`);
        return guardRef.items.every((item) => this.evaluateGuard(item, context, event, state));
      }

      if (guardRef.type === 'or') {
        this.log(`   🛡️  Evaluating OR guard`);
        return guardRef.items.some((item) => this.evaluateGuard(item, context, event, state));
      }

      if (guardRef.type === 'not') {
        this.log(`   🛡️  Evaluating NOT guard`);
        return !this.evaluateGuard(guardRef.item, context, event, state);
      }
    }

    return true;
  }

  /**
   * Select enabled transitions for the given event from the current configuration
   * Returns the first enabled transition for each active atomic state
   * Deduplicates transitions from shared ancestors (important for parallel states)
   * Implements shadowing: child transitions shadow parent transitions
   */
  private selectTransitions(
    event: Event,
    config: Set<string>,
    context: Context
  ): Array<{ source: StateNode; transition: NodeTransition }> {
    const atomicNodes = this.getActiveAtomicNodes(config);
    this.log(
      `🔍 Checking transitions for active atomic states:`,
      atomicNodes.map((n) => n.id)
    );

    const selectedTransitions: Array<{ source: StateNode; transition: NodeTransition }> = [];
    const seenTransitions = new Set<string>(); // Track transitions by definition node ID + transition index

    // For each active atomic state, find enabled transition
    for (const atomicNode of atomicNodes) {
      this.log(`   Checking state: ${atomicNode.id}`);

      // Check transitions from this node and ancestors (document order)
      const ancestors = atomicNode.getAncestors(); // [self, parent, ..., root]

      for (const node of ancestors) {
        const transitions = node.getTransitions(event.type);

        if (transitions.length > 0) {
          this.log(
            `   Found ${transitions.length} transition(s) on event "${event.type}" in ${node.id}`
          );
        }

        // Find first enabled transition
        for (let i = 0; i < transitions.length; i++) {
          const transition = transitions[i]!;

          // Create a unique key for this transition definition
          // This prevents duplicate execution when multiple children share a parent transition
          const transitionKey = `${node.id}:${event.type}:${i}`;

          if (seenTransitions.has(transitionKey)) {
            this.log(`   ⊗ Skipping duplicate transition from ${node.id} (already selected)`);
            continue;
          }

          // Check guard if present
          if (transition.guard) {
            if (!this.evaluateGuard(transition.guard, context, event, node.id)) {
              continue;
            }
          }

          // Found enabled transition
          const targetDesc = transition.targetIds ? transition.targetIds.join(', ') : 'internal';
          this.log(`   ✓ Selected transition: ${node.id} → ${targetDesc}`);
          selectedTransitions.push({ source: node, transition }); // Use actual source node, not atomicNode
          seenTransitions.add(transitionKey);
          break; // Stop at first enabled transition for this source
        }

        // If we found a transition, stop checking ancestors
        if (selectedTransitions.some((t) => t.source === node || node.isDescendantOf(t.source))) {
          break;
        }
      }
    }

    // Apply shadowing: filter out parent transitions whose children handled the event
    // Algorithm:
    // 1. For each selected transition, mark all parallel ancestors as "child-handled"
    // 2. Remove transitions where the source is a parallel state marked as "child-handled"
    const parallelStatesWithHandlers = new Set<string>();

    // Pass 1: Identify which parallel states have children that handled the event
    for (const { source } of selectedTransitions) {
      let current = source.parent;
      while (current) {
        if (current.isParallel()) {
          parallelStatesWithHandlers.add(current.id);
          this.log(`   📍 Marking parallel state ${current.id} as child-handled`);
        }
        current = current.parent;
      }
    }

    // Pass 2: Filter out shadowed parent transitions
    const filteredTransitions = selectedTransitions.filter(({ source }) => {
      if (source.isParallel() && parallelStatesWithHandlers.has(source.id)) {
        this.log(`   🚫 Shadowing parent transition from ${source.id} (children handled event)`);
        return false;
      }
      return true;
    });

    return filteredTransitions;
  }

  /**
   * Select enabled always transitions from the current configuration
   * Always transitions are eventless and checked after state stabilization
   */
  private selectAlwaysTransitions(
    config: Set<string>,
    context: Context
  ): Array<{ source: StateNode; transition: NodeTransition }> {
    const atomicNodes = this.getActiveAtomicNodes(config);
    const selectedTransitions: Array<{ source: StateNode; transition: NodeTransition }> = [];

    // For each active atomic state, find enabled always transition
    for (const atomicNode of atomicNodes) {
      // Check always transitions from this node and ancestors (document order)
      const ancestors = atomicNode.getAncestors(); // [self, parent, ..., root]

      for (const node of ancestors) {
        const transitions = node.alwaysTransitions;

        if (transitions.length > 0) {
          this.log(`   Found ${transitions.length} always transition(s) in ${node.id}`);
        }

        // Find first enabled always transition
        for (const transition of transitions) {
          // Check guard if present
          if (transition.guard) {
            // Create a synthetic event for guard evaluation
            const syntheticEvent = { type: '__always__' } as Event;
            if (!this.evaluateGuard(transition.guard, context, syntheticEvent, node.id)) {
              continue;
            }
          }

          // Found enabled always transition
          const targetDesc = transition.targetIds ? transition.targetIds.join(', ') : 'internal';
          this.log(`   ✓ Selected always transition: ${node.id} → ${targetDesc}`);
          selectedTransitions.push({ source: atomicNode, transition });
          break; // Stop at first enabled transition for this source
        }

        // If we found a transition, stop checking ancestors
        if (selectedTransitions.some((t) => t.source === atomicNode)) {
          break;
        }
      }
    }

    return selectedTransitions;
  }

  /**
   * Process a list of transitions and update context and configuration
   * Used by both event transitions and always transitions
   */
  private processTransitions(
    transitions: Array<{ source: StateNode; transition: NodeTransition }>,
    event: Event,
    context: Context,
    config: Set<string>
  ): Context {
    let newContext = context;

    // Process each transition
    for (const { source, transition } of transitions) {
      // Handle internal transitions (no target = context-only)
      if (!transition.targetIds || transition.targetIds.length === 0) {
        this.log(`\n🔀 Internal transition in: ${source.id}`);
        // Internal transition: just execute assign actions
        if (transition.assign) {
          const stateId = source.id;
          newContext = this.executeReducer(transition.assign, newContext, event, stateId);
        }
        continue;
      }

      // External transition: compute exit/entry sets
      const targetId = transition.targetIds[0];
      if (!targetId) {
        throw new Error('Transition has empty targetIds array');
      }

      const target = this.nodesById.get(targetId);
      if (!target) {
        throw new Error(`Target state "${targetId}" not found`);
      }

      // Handle self-transition (source === target)
      // In XState, self-transitions exit and re-enter the state
      if (source === target) {
        this.log(`\n🔀 Self-transition: ${source.id}`);

        // Exit the state
        newContext = this.deactivateState(source, event, newContext);
        config.delete(source.id);

        // Execute transition assign
        if (transition.assign) {
          newContext = this.executeReducer(transition.assign, newContext, event, source.id);
        }

        // Re-enter the state
        newContext = this.activateState(source, event, newContext, config);
        continue;
      }

      // Find LCA (Least Common Ancestor)
      const lca = this.findLCA(source, target);

      // Special case: if target === lca, this is a transition to an ancestor
      // We need to exit up to and including the target, then re-enter it
      const isTransitionToAncestor = target === lca;

      // Compute exit set: nodes from source up to (but not including) LCA
      // UNLESS target === lca, then include the LCA itself
      const exitSet: StateNode[] = [];
      let current: StateNode | null = source;
      while (current && current !== lca) {
        exitSet.push(current);
        current = current.parent;
      }
      if (isTransitionToAncestor && lca !== this.root) {
        exitSet.push(lca); // Include the target itself
      }

      // Compute entry set: nodes from LCA down to target (excluding LCA)
      // UNLESS target === lca, then include the LCA itself
      const entrySet: StateNode[] = [];
      if (isTransitionToAncestor && lca !== this.root) {
        entrySet.push(lca); // Include the target itself
      } else {
        current = target;
        while (current && current !== lca) {
          entrySet.unshift(current); // Add to front for root→leaf order
          current = current.parent;
        }
      }

      this.log(`\n🔀 Transition: ${source.id} → ${target.id}`);
      this.log(`   LCA: ${lca.id}`);
      this.log(
        `   Exit set:`,
        exitSet.map((n) => n.id)
      );
      this.log(
        `   Entry set:`,
        entrySet.map((n) => n.id)
      );

      // Execute exit actions (leaf to root)
      for (const node of exitSet) {
        newContext = this.deactivateState(node, event, newContext);
        config.delete(node.id);

        // Also remove all descendants of this node from configuration
        // (Important for parallel states where children remain active)
        for (const stateId of Array.from(config)) {
          const stateNode = this.nodesById.get(stateId);
          if (stateNode && stateNode.isDescendantOf(node)) {
            config.delete(stateId);
          }
        }
      }

      // Execute transition assign actions
      if (transition.assign) {
        const stateId = source.id;
        this.log(`   ⚙️  Executing transition assign`);
        newContext = this.executeReducer(transition.assign, newContext, event, stateId);
      }

      // Execute entry actions (root to leaf)
      // Enter all nodes in entry set WITHOUT following children
      for (let i = 0; i < entrySet.length; i++) {
        const node = entrySet[i]!;
        const isLast = i === entrySet.length - 1;
        // Only follow children for the last node (the explicit target)
        newContext = this.activateState(node, event, newContext, config, isLast);
      }
    }

    return newContext;
  }

  /**
   * Main event handler - processes an event and transitions the machine
   *
   * Algorithm:
   * 1. Select enabled transitions from current configuration
   * 2. For each transition, compute exit and entry sets using LCA
   * 3. Execute exits (leaf to root order)
   * 4. Execute transition assigns
   * 5. Execute entries (root to leaf order)
   * 6. Update configuration and context
   * 7. Evaluate always transitions until none are enabled (microsteps)
   */
  send(event: Event): void {
    // Check if machine is started
    if (!this.started) {
      throw new Error('Cannot send events: machine not started. Call start() first.');
    }

    // If machine is halted, return immediately without processing
    if (this.halted) {
      this.log(`⏹️  Machine halted, ignoring event: ${event.type}`);
      return;
    }

    this.log(`\n📨 Event received: ${event.type}`);
    this.log(`   Current configuration:`, Array.from(this.configuration));

    const selectedTransitions = this.selectTransitions(event, this.configuration, this.context);

    // If no transitions are enabled, check always transitions anyway
    // If no transitions are enabled, check always transitions anyway
    if (selectedTransitions.length === 0) {
      this.log(`   No enabled transitions found`);

      // Store config before always transitions to check if anything changed
      const configBefore = new Set(this.configuration);
      const contextBefore = this.context;

      // Still need to check always transitions even if no event transitions
      this.evaluateAlwaysTransitions(event);
      this.checkFinalStates();

      // Only capture history if always transitions actually changed something
      const configChanged =
        this.configuration.size !== configBefore.size ||
        ![...this.configuration].every((id) => configBefore.has(id));
      const contextChanged = this.context !== contextBefore;

      if (configChanged || contextChanged) {
        this.captureHistory();
      }

      return;
    }

    this.log(`\n🔀 Processing ${selectedTransitions.length} transition(s)`);

    let newContext = this.context;
    const newConfig = new Set<string>(this.configuration);

    // Process event transitions
    newContext = this.processTransitions(selectedTransitions, event, newContext, newConfig);

    // Update machine state
    this.context = newContext;
    this.configuration = newConfig;

    this.log(`\n✅ New configuration:`, Array.from(this.configuration));

    // Evaluate always transitions (may cause additional transitions)
    this.evaluateAlwaysTransitions(event);

    // Check if we've reached a final state
    this.checkFinalStates();

    // Capture state to history after all transitions complete
    this.captureHistory();
  }

  /**
   * Evaluate always transitions in microsteps until no more are enabled
   * This implements XState's eventless transition behavior
   */
  private evaluateAlwaysTransitions(event: Event): void {
    const MAX_ITERATIONS = 100; // Prevent infinite loops
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const alwaysTransitions = this.selectAlwaysTransitions(this.configuration, this.context);

      if (alwaysTransitions.length === 0) {
        // No more always transitions enabled, we're done
        break;
      }

      // Check if all transitions are internal (no target)
      const allInternal = alwaysTransitions.every(
        ({ transition }) => !transition.targetIds || transition.targetIds.length === 0
      );

      this.log(
        `\n⚡ Processing ${alwaysTransitions.length} always transition(s) (iteration ${iterations})`
      );

      let newContext = this.context;
      const newConfig = new Set<string>(this.configuration);

      // Process always transitions
      newContext = this.processTransitions(alwaysTransitions, event, newContext, newConfig);

      // Update machine state
      this.context = newContext;
      this.configuration = newConfig;

      this.log(`\n✅ Configuration after always:`, Array.from(this.configuration));

      // If all transitions were internal (no target), stop looping
      // Internal transitions don't change configuration, so they won't re-enable
      if (allInternal) {
        break;
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      throw new Error('Maximum always transition iterations reached - possible infinite loop');
    }
  }

  /**
   * Compile the state tree from configuration
   */
  private compileTree(config: StateMachineConfig<Context, Event>): StateNode {
    // Create synthetic root node
    const root = new StateNode('__root__', '__root__', 'compound', null);
    this.nodesById.set(root.id, root);

    // Compile all top-level states
    for (const [stateKey, stateConfig] of Object.entries(config.states)) {
      const stateNode = this.compileNode(stateKey, stateConfig, root);
      root.addChild(stateNode);
    }

    // Set initial state
    const initialNode = this.nodesById.get(config.initial);
    if (!initialNode) {
      throw new Error(`Initial state "${config.initial}" not found`);
    }
    root.setInitial(initialNode);

    // Compile top-level transitions if any
    if (config.on) {
      this.compileTransitions(root, config.on);
    }

    return root;
  }

  /**
   * Compile a single state node recursively
   */
  private compileNode(key: string, stateConfig: StateConfig<Event>, parent: StateNode): StateNode {
    const nodeId = parent.id === '__root__' ? key : `${parent.id}.${key}`;

    // Check if this is a final state
    const isFinal = stateConfig.type === 'final';

    // Determine node kind
    let kind: NodeKind = 'atomic';
    if (stateConfig.states) {
      // Explicit type override from config, or infer from initial
      if (stateConfig.type === 'parallel') {
        kind = 'parallel';
      } else {
        kind = stateConfig.initial ? 'compound' : 'parallel';
      }
    }

    // Create the node
    const node = new StateNode(nodeId, key, kind, parent, isFinal);
    this.nodesById.set(nodeId, node);

    // Compile children if any
    if (stateConfig.states) {
      for (const [childKey, childConfig] of Object.entries(stateConfig.states)) {
        const childNode = this.compileNode(childKey, childConfig, node);
        node.addChild(childNode);

        // For parallel states, all children are regions
        if (kind === 'parallel') {
          node.addRegion(childNode);
        }
      }

      // Set initial child for compound states
      if (kind === 'compound' && stateConfig.initial) {
        const initialChild = node.children.find((c) => c.key === stateConfig.initial);
        if (!initialChild) {
          throw new Error(`Initial state "${stateConfig.initial}" not found in ${nodeId}`);
        }
        node.setInitial(initialChild);
      }
    }

    // Compile transitions
    if (stateConfig.on) {
      this.compileTransitions(node, stateConfig.on);
    }

    // Compile always transitions
    if (stateConfig.always) {
      const alwaysArray = Array.isArray(stateConfig.always)
        ? stateConfig.always
        : [stateConfig.always];
      const alwaysTransitions = alwaysArray.map((t) => this.compileTransition(t, node));
      node.addAlwaysTransitions(alwaysTransitions);
    }

    // Set activities
    if (stateConfig.activities) {
      node.setActivities(stateConfig.activities);
    }

    // Set onEntry actions
    if (stateConfig.onEntry) {
      node.setOnEntry(stateConfig.onEntry);
    }

    // Set onExit actions
    if (stateConfig.onExit) {
      node.setOnExit(stateConfig.onExit);
    }

    return node;
  }

  /**
   * Compile on transitions for a node
   */
  private compileTransitions(node: StateNode, onConfig: Record<string, any>): void {
    for (const [eventType, transitionConfig] of Object.entries(onConfig)) {
      const transitions = Array.isArray(transitionConfig)
        ? transitionConfig.map((t) => this.compileTransition(t, node))
        : [this.compileTransition(transitionConfig, node)];

      node.addOnTransitions(eventType, transitions);
    }
  }

  /**
   * Compile a single transition
   * Note: Target IDs are stored as-is and resolved in a second pass
   */
  private compileTransition(transitionConfig: any, _contextNode: StateNode): NodeTransition {
    // Simple string target
    if (typeof transitionConfig === 'string') {
      return {
        targetIds: [transitionConfig], // Store as-is, resolve later
      };
    }

    const transition: NodeTransition = {};

    if (transitionConfig.target) {
      transition.targetIds = [transitionConfig.target]; // Store as-is, resolve later
    }

    if (transitionConfig.guard) {
      transition.guard = transitionConfig.guard;
    }

    if (transitionConfig.assign) {
      transition.assign = transitionConfig.assign;
    }

    return transition;
  }

  /**
   * Resolve a target reference to absolute node ID
   */
  private resolveTargetId(target: string, contextNode: StateNode): string {
    // Already an absolute path (contains dot)
    if (target.includes('.')) {
      return target;
    }

    // Check if it's a top-level state
    if (this.nodesById.has(target)) {
      return target;
    }

    // Try to find sibling
    if (contextNode.parent) {
      for (const sibling of contextNode.parent.children) {
        if (sibling.key === target) {
          return sibling.id;
        }
      }
    }

    // Return as-is if we can't resolve (will cause error later if invalid)
    return target;
  }
}
