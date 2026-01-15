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
} from './types';

/**
 * StateMachine class
 */
export class StateMachine<Context extends StateContext, Event extends BaseEvent> {
  private root: StateNode;
  private context: Context;
  
  // Registries
  private guards: Map<string | symbol, Guard<Context, Event>> = new Map();
  private reducers: Map<string | symbol, Reducer<Context, Event>> = new Map();
  
  // Node lookup by ID
  private nodesById: Map<string, StateNode> = new Map();

  constructor(config: StateMachineConfig<Context, Event>) {
    this.context = config.initialContext;

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
  private compileNode(
    key: string,
    stateConfig: StateConfig<Event>,
    parent: StateNode
  ): StateNode {
    const nodeId = parent.id === '__root__' ? key : `${parent.id}.${key}`;

    // Determine node kind
    let kind: NodeKind = 'atomic';
    if (stateConfig.states) {
      kind = stateConfig.initial ? 'compound' : 'parallel';
    }

    // Create the node
    const node = new StateNode(nodeId, key, kind, parent);
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
      const alwaysTransitions = stateConfig.always.map((t) =>
        this.compileTransition(t, node)
      );
      node.addAlwaysTransitions(alwaysTransitions);
    }

    // Set activities
    if (stateConfig.activities) {
      node.setActivities(stateConfig.activities);
    }

    return node;
  }

  /**
   * Compile on transitions for a node
   */
  private compileTransitions(
    node: StateNode,
    onConfig: Record<string, any>
  ): void {
    for (const [eventType, transitionConfig] of Object.entries(onConfig)) {
      const transitions = Array.isArray(transitionConfig)
        ? transitionConfig.map((t) => this.compileTransition(t, node))
        : [this.compileTransition(transitionConfig, node)];
      
      node.addOnTransitions(eventType, transitions);
    }
  }

  /**
   * Compile a single transition
   */
  private compileTransition(transitionConfig: any, contextNode: StateNode): NodeTransition {
    // Simple string target
    if (typeof transitionConfig === 'string') {
      return {
        targetIds: [this.resolveTargetId(transitionConfig, contextNode)],
      };
    }

    const transition: NodeTransition = {};

    if (transitionConfig.target) {
      transition.targetIds = [this.resolveTargetId(transitionConfig.target, contextNode)];
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
