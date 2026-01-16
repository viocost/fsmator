import { describe, it, expect } from 'vitest';
import { and, or, not, type GuardRef } from '../src/types';

describe('Guard Utility Functions', () => {
  describe('and', () => {
    it('should combine multiple guard references with and', () => {
      const result = and('GUARD_A', 'GUARD_B', 'GUARD_C');
      
      expect(result).toEqual({
        type: 'and',
        items: ['GUARD_A', 'GUARD_B', 'GUARD_C'],
      });
    });

    it('should work with symbols', () => {
      const guardA = Symbol('GUARD_A');
      const guardB = Symbol('GUARD_B');
      const result = and(guardA, guardB);
      
      expect(result).toEqual({
        type: 'and',
        items: [guardA, guardB],
      });
    });

    it('should work with nested guard references', () => {
      const result = and('GUARD_A', or('GUARD_B', 'GUARD_C'));
      
      expect(result).toEqual({
        type: 'and',
        items: [
          'GUARD_A',
          {
            type: 'or',
            items: ['GUARD_B', 'GUARD_C'],
          },
        ],
      });
    });

    it('should work with single guard', () => {
      const result = and('GUARD_A');
      
      expect(result).toEqual({
        type: 'and',
        items: ['GUARD_A'],
      });
    });
  });

  describe('or', () => {
    it('should combine multiple guard references with or', () => {
      const result = or('GUARD_A', 'GUARD_B', 'GUARD_C');
      
      expect(result).toEqual({
        type: 'or',
        items: ['GUARD_A', 'GUARD_B', 'GUARD_C'],
      });
    });

    it('should work with symbols', () => {
      const guardA = Symbol('GUARD_A');
      const guardB = Symbol('GUARD_B');
      const result = or(guardA, guardB);
      
      expect(result).toEqual({
        type: 'or',
        items: [guardA, guardB],
      });
    });

    it('should work with nested guard references', () => {
      const result = or('GUARD_A', and('GUARD_B', 'GUARD_C'));
      
      expect(result).toEqual({
        type: 'or',
        items: [
          'GUARD_A',
          {
            type: 'and',
            items: ['GUARD_B', 'GUARD_C'],
          },
        ],
      });
    });
  });

  describe('not', () => {
    it('should negate a guard reference', () => {
      const result = not('GUARD_A');
      
      expect(result).toEqual({
        type: 'not',
        item: 'GUARD_A',
      });
    });

    it('should work with symbols', () => {
      const guardA = Symbol('GUARD_A');
      const result = not(guardA);
      
      expect(result).toEqual({
        type: 'not',
        item: guardA,
      });
    });

    it('should work with nested guard references', () => {
      const result = not(or('GUARD_A', 'GUARD_B'));
      
      expect(result).toEqual({
        type: 'not',
        item: {
          type: 'or',
          items: ['GUARD_A', 'GUARD_B'],
        },
      });
    });

    it('should work with double negation', () => {
      const result = not(not('GUARD_A'));
      
      expect(result).toEqual({
        type: 'not',
        item: {
          type: 'not',
          item: 'GUARD_A',
        },
      });
    });
  });

  describe('Complex combinations', () => {
    it('should create complex nested guard structures', () => {
      const result = and(
        'SOME_GUARD',
        or(
          'GUARD_A',
          not('GUARD_B')
        )
      );
      
      expect(result).toEqual({
        type: 'and',
        items: [
          'SOME_GUARD',
          {
            type: 'or',
            items: [
              'GUARD_A',
              {
                type: 'not',
                item: 'GUARD_B',
              },
            ],
          },
        ],
      });
    });

    it('should match the expected JSON structure from usage example', () => {
      const result = and(
        'SOME_GUARD',
        or(
          'A',
          not('B')
        )
      );
      
      expect(result).toEqual({
        type: 'and',
        items: [
          'SOME_GUARD',
          {
            type: 'or',
            items: [
              'A',
              { type: 'not', item: 'B' },
            ],
          },
        ],
      });
    });

    it('should handle deeply nested structures', () => {
      const result = or(
        and('A', 'B'),
        and(
          not('C'),
          or('D', 'E')
        )
      );
      
      expect(result).toEqual({
        type: 'or',
        items: [
          {
            type: 'and',
            items: ['A', 'B'],
          },
          {
            type: 'and',
            items: [
              { type: 'not', item: 'C' },
              {
                type: 'or',
                items: ['D', 'E'],
              },
            ],
          },
        ],
      });
    });
  });

  describe('Type safety', () => {
    it('should accept GuardRef type', () => {
      const guardRef: GuardRef = 'GUARD_A';
      const result = and(guardRef);
      
      expect(result).toEqual({
        type: 'and',
        items: ['GUARD_A'],
      });
    });

    it('should accept complex GuardRef structures', () => {
      const complexGuard: GuardRef = {
        type: 'or',
        items: ['A', 'B'],
      };
      
      const result = not(complexGuard);
      
      expect(result).toEqual({
        type: 'not',
        item: {
          type: 'or',
          items: ['A', 'B'],
        },
      });
    });
  });
});
