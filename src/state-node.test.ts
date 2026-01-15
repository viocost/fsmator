import { describe, it, expect } from 'vitest';
import { StateNode } from './state-node';

describe('StateNode', () => {
  describe('construction', () => {
    it('should create an atomic node', () => {
      const node = new StateNode('idle', 'idle', 'atomic', null);
      
      expect(node.id).toBe('idle');
      expect(node.key).toBe('idle');
      expect(node.kind).toBe('atomic');
      expect(node.parent).toBe(null);
      expect(node.isAtomic()).toBe(true);
      expect(node.isCompound()).toBe(false);
      expect(node.isParallel()).toBe(false);
    });

    it('should create a compound node with parent', () => {
      const parent = new StateNode('root', 'root', 'compound', null);
      const child = new StateNode('root.child', 'child', 'atomic', parent);
      
      expect(child.parent).toBe(parent);
      expect(child.id).toBe('root.child');
    });
  });

  describe('children management', () => {
    it('should add children to a node', () => {
      const parent = new StateNode('parent', 'parent', 'compound', null);
      const child1 = new StateNode('parent.child1', 'child1', 'atomic', parent);
      const child2 = new StateNode('parent.child2', 'child2', 'atomic', parent);
      
      parent.addChild(child1);
      parent.addChild(child2);
      
      expect(parent.children).toHaveLength(2);
      expect(parent.children[0]).toBe(child1);
      expect(parent.children[1]).toBe(child2);
    });

    it('should set initial child for compound state', () => {
      const parent = new StateNode('parent', 'parent', 'compound', null);
      const child = new StateNode('parent.child', 'child', 'atomic', parent);
      
      parent.setInitial(child);
      
      expect(parent.initial).toBe(child);
    });

    it('should throw when setting initial on non-compound state', () => {
      const atomic = new StateNode('atomic', 'atomic', 'atomic', null);
      const child = new StateNode('atomic.child', 'child', 'atomic', atomic);
      
      expect(() => atomic.setInitial(child)).toThrow();
    });

    it('should add regions to parallel state', () => {
      const parallel = new StateNode('parallel', 'parallel', 'parallel', null);
      const region1 = new StateNode('parallel.r1', 'r1', 'compound', parallel);
      const region2 = new StateNode('parallel.r2', 'r2', 'compound', parallel);
      
      parallel.addRegion(region1);
      parallel.addRegion(region2);
      
      expect(parallel.regions).toHaveLength(2);
      expect(parallel.regions[0]).toBe(region1);
    });
  });

  describe('ancestor queries', () => {
    it('should get ancestor chain', () => {
      const root = new StateNode('root', 'root', 'compound', null);
      const parent = new StateNode('root.parent', 'parent', 'compound', root);
      const child = new StateNode('root.parent.child', 'child', 'atomic', parent);
      
      const ancestors = child.getAncestors();
      
      expect(ancestors).toHaveLength(3);
      expect(ancestors[0]).toBe(child);
      expect(ancestors[1]).toBe(parent);
      expect(ancestors[2]).toBe(root);
    });

    it('should calculate depth correctly', () => {
      const root = new StateNode('root', 'root', 'compound', null);
      const parent = new StateNode('root.parent', 'parent', 'compound', root);
      const child = new StateNode('root.parent.child', 'child', 'atomic', parent);
      
      expect(root.getDepth()).toBe(0);
      expect(parent.getDepth()).toBe(1);
      expect(child.getDepth()).toBe(2);
    });

    it('should check descendant relationship', () => {
      const root = new StateNode('root', 'root', 'compound', null);
      const parent = new StateNode('root.parent', 'parent', 'compound', root);
      const child = new StateNode('root.parent.child', 'child', 'atomic', parent);
      
      expect(child.isDescendantOf(parent)).toBe(true);
      expect(child.isDescendantOf(root)).toBe(true);
      expect(parent.isDescendantOf(child)).toBe(false);
      expect(root.isDescendantOf(child)).toBe(false);
    });
  });

  describe('transitions', () => {
    it('should add and retrieve on transitions', () => {
      const node = new StateNode('idle', 'idle', 'atomic', null);
      
      node.addOnTransitions('NEXT', [{ targetIds: ['active'] }]);
      
      const transitions = node.getTransitions('NEXT');
      expect(transitions).toHaveLength(1);
      expect(transitions[0]?.targetIds).toEqual(['active']);
    });

    it('should return empty array for non-existent event', () => {
      const node = new StateNode('idle', 'idle', 'atomic', null);
      
      const transitions = node.getTransitions('UNKNOWN');
      expect(transitions).toHaveLength(0);
    });

    it('should add always transitions', () => {
      const node = new StateNode('idle', 'idle', 'atomic', null);
      
      node.addAlwaysTransitions([{ targetIds: ['active'] }]);
      
      expect(node.alwaysTransitions).toHaveLength(1);
    });
  });

  describe('activities', () => {
    it('should set and get activities', () => {
      const node = new StateNode('idle', 'idle', 'atomic', null);
      
      node.setActivities(['ACTIVITY_ONE', 'ACTIVITY_TWO']);
      
      expect(node.activities).toEqual(['ACTIVITY_ONE', 'ACTIVITY_TWO']);
    });
  });
});
