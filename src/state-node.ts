/**
 * StateNode represents a single node in the state tree
 * It knows about its structure but not about the overall schema or execution
 */

import type { GuardRef } from './types';

/**
 * Node kind - determines how children are handled
 */
export type NodeKind = 'atomic' | 'compound' | 'parallel';

/**
 * Transition definition at the node level
 */
export interface NodeTransition {
  targetIds?: string[]; // undefined = internal transition (context-only)
  guard?: GuardRef;
  assign?: string | symbol;
}

/**
 * StateNode class - represents a node in the state hierarchy
 */
export class StateNode {
  readonly id: string;
  readonly key: string;
  readonly kind: NodeKind;
  readonly parent: StateNode | null;
  readonly final: boolean;

  private _children: StateNode[] = [];
  private _initial: StateNode | null = null;
  private _regionChildren: StateNode[] = []; // for parallel states

  // Transitions
  private _onTransitions: Map<string, NodeTransition[]> = new Map();
  private _alwaysTransitions: NodeTransition[] = [];

  // Activities
  private _activities: Array<string | symbol> = [];

  // Entry and exit actions
  private _onEntry: Array<string | symbol> = [];
  private _onExit: Array<string | symbol> = [];

  constructor(id: string, key: string, kind: NodeKind, parent: StateNode | null, final = false) {
    this.id = id;
    this.key = key;
    this.kind = kind;
    this.parent = parent;
    this.final = final;
  }

  /**
   * Add a child node
   */
  addChild(child: StateNode): void {
    this._children.push(child);
  }

  /**
   * Set the initial child (for compound states)
   */
  setInitial(child: StateNode): void {
    if (this.kind !== 'compound') {
      throw new Error(`Cannot set initial child on ${this.kind} state ${this.id}`);
    }
    this._initial = child;
  }

  /**
   * Add a region child (for parallel states)
   */
  addRegion(child: StateNode): void {
    if (this.kind !== 'parallel') {
      throw new Error(`Cannot add region to ${this.kind} state ${this.id}`);
    }
    this._regionChildren.push(child);
  }

  /**
   * Add transitions for an event type
   */
  addOnTransitions(eventType: string, transitions: NodeTransition[]): void {
    this._onTransitions.set(eventType, transitions);
  }

  /**
   * Add always transitions
   */
  addAlwaysTransitions(transitions: NodeTransition[]): void {
    this._alwaysTransitions.push(...transitions);
  }

  /**
   * Set activities
   */
  setActivities(activities: Array<string | symbol>): void {
    this._activities = activities;
  }

  /**
   * Set onEntry actions
   */
  setOnEntry(actions: Array<string | symbol>): void {
    this._onEntry = actions;
  }

  /**
   * Set onExit actions
   */
  setOnExit(actions: Array<string | symbol>): void {
    this._onExit = actions;
  }

  /**
   * Get all children
   */
  get children(): readonly StateNode[] {
    return this._children;
  }

  /**
   * Get initial child (compound states only)
   */
  get initial(): StateNode | null {
    return this._initial;
  }

  /**
   * Get region children (parallel states only)
   */
  get regions(): readonly StateNode[] {
    return this._regionChildren;
  }

  /**
   * Get transitions for an event type
   */
  getTransitions(eventType: string): readonly NodeTransition[] {
    return this._onTransitions.get(eventType) || [];
  }

  /**
   * Get always transitions
   */
  get alwaysTransitions(): readonly NodeTransition[] {
    return this._alwaysTransitions;
  }

  /**
   * Get activities
   */
  get activities(): ReadonlyArray<string | symbol> {
    return this._activities;
  }

  /**
   * Get onEntry actions
   */
  get onEntry(): ReadonlyArray<string | symbol> {
    return this._onEntry;
  }

  /**
   * Get onExit actions
   */
  get onExit(): ReadonlyArray<string | symbol> {
    return this._onExit;
  }

  /**
   * Get ancestor chain from this node to root [self, parent, ..., root]
   */
  getAncestors(): StateNode[] {
    const ancestors: StateNode[] = [this];
    let current = this.parent;
    while (current) {
      ancestors.push(current);
      current = current.parent;
    }
    return ancestors;
  }

  /**
   * Get depth in tree (root = 0)
   */
  getDepth(): number {
    let depth = 0;
    let current = this.parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * Check if this node is a descendant of another node
   */
  isDescendantOf(node: StateNode): boolean {
    let current = this.parent;
    while (current) {
      if (current === node) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Check if this is an atomic (leaf) node
   */
  isAtomic(): boolean {
    return this.kind === 'atomic';
  }

  /**
   * Check if this is a compound node
   */
  isCompound(): boolean {
    return this.kind === 'compound';
  }

  /**
   * Check if this is a parallel node
   */
  isParallel(): boolean {
    return this.kind === 'parallel';
  }
}
