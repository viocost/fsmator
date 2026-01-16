/**
 * Integration tests for context-changes example
 */

import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';

type ShoppingContext = {
  cart: Array<{ id: string; name: string; price: number; quantity: number }>;
  total: number;
  discount: number;
  user: { name: string; email: string } | null;
};

type ShoppingEvent =
  | { type: 'ADD_ITEM'; item: { id: string; name: string; price: number } }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'UPDATE_QUANTITY'; itemId: string; quantity: number }
  | { type: 'APPLY_DISCOUNT'; percent: number }
  | { type: 'LOGIN'; user: { name: string; email: string } }
  | { type: 'LOGOUT' }
  | { type: 'CHECKOUT' }
  | { type: 'RESET' };

describe('Context Changes Integration (Shopping Cart)', () => {
  function createShoppingMachine() {
    const config: StateMachineConfig<ShoppingContext, ShoppingEvent> = {
      initial: 'browsing',
      debug: false,
      initialContext: {
        cart: [],
        total: 0,
        discount: 0,
        user: null,
      },
      states: {
        browsing: {
          on: {
            ADD_ITEM: { assign: 'addItem' },
            REMOVE_ITEM: { assign: 'removeItem' },
            UPDATE_QUANTITY: { assign: 'updateQuantity' },
            APPLY_DISCOUNT: { assign: 'applyDiscount' },
            LOGIN: { assign: 'loginUser' },
            LOGOUT: { assign: 'logoutUser' },
            CHECKOUT: 'checkout',
          },
        },
        checkout: {
          on: {
            RESET: { target: 'browsing', assign: 'resetCart' },
          },
        },
      },
      reducers: {
        addItem: ({ context, event }) => {
          if (event.type !== 'ADD_ITEM') return {};

          const existingItemIndex = context.cart.findIndex((i) => i.id === event.item.id);

          let newCart;
          if (existingItemIndex >= 0) {
            newCart = context.cart.map((item, idx) =>
              idx === existingItemIndex ? { ...item, quantity: item.quantity + 1 } : item
            );
          } else {
            newCart = [...context.cart, { ...event.item, quantity: 1 }];
          }

          const newTotal = newCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
          return { cart: newCart, total: newTotal };
        },
        removeItem: ({ context, event }) => {
          if (event.type !== 'REMOVE_ITEM') return {};

          const newCart = context.cart.filter((item) => item.id !== event.itemId);
          const newTotal = newCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
          return { cart: newCart, total: newTotal };
        },
        updateQuantity: ({ context, event }) => {
          if (event.type !== 'UPDATE_QUANTITY') return {};

          const newCart = context.cart.map((item) =>
            item.id === event.itemId ? { ...item, quantity: event.quantity } : item
          );
          const newTotal = newCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
          return { cart: newCart, total: newTotal };
        },
        applyDiscount: ({ event }) => {
          if (event.type !== 'APPLY_DISCOUNT') return {};
          return { discount: event.percent };
        },
        loginUser: ({ event }) => {
          if (event.type !== 'LOGIN') return {};
          return { user: { ...event.user } };
        },
        logoutUser: () => {
          return { user: null };
        },
        resetCart: () => {
          return { cart: [], total: 0, discount: 0 };
        },
      },
    };

    return new StateMachine(config).start();
  }

  it('should initialize with empty cart', () => {
    const machine = createShoppingMachine();

    expect(machine.getContext().cart).toEqual([]);
    expect(machine.getContext().total).toBe(0);
    expect(machine.getContext().user).toBeNull();
  });

  it('should add item to cart', () => {
    const machine = createShoppingMachine();

    machine.send({ type: 'ADD_ITEM', item: { id: '1', name: 'Laptop', price: 999.99 } });

    expect(machine.getContext().cart).toHaveLength(1);
    expect(machine.getContext().cart[0]).toEqual({
      id: '1',
      name: 'Laptop',
      price: 999.99,
      quantity: 1,
    });
    expect(machine.getContext().total).toBe(999.99);
  });

  it('should add multiple different items', () => {
    const machine = createShoppingMachine();

    machine.send({ type: 'ADD_ITEM', item: { id: '1', name: 'Laptop', price: 999.99 } });
    machine.send({ type: 'ADD_ITEM', item: { id: '2', name: 'Mouse', price: 29.99 } });

    expect(machine.getContext().cart).toHaveLength(2);
    expect(machine.getContext().total).toBeCloseTo(1029.98, 2);
  });

  it('should increment quantity when adding same item', () => {
    const machine = createShoppingMachine();

    machine.send({ type: 'ADD_ITEM', item: { id: '1', name: 'Laptop', price: 999.99 } });
    machine.send({ type: 'ADD_ITEM', item: { id: '1', name: 'Laptop', price: 999.99 } });

    expect(machine.getContext().cart).toHaveLength(1);
    expect(machine.getContext().cart[0]?.quantity).toBe(2);
    expect(machine.getContext().total).toBeCloseTo(1999.98, 2);
  });

  it('should remove item from cart', () => {
    const machine = createShoppingMachine();

    machine.send({ type: 'ADD_ITEM', item: { id: '1', name: 'Laptop', price: 999.99 } });
    machine.send({ type: 'ADD_ITEM', item: { id: '2', name: 'Mouse', price: 29.99 } });
    machine.send({ type: 'REMOVE_ITEM', itemId: '1' });

    expect(machine.getContext().cart).toHaveLength(1);
    expect(machine.getContext().cart[0]?.id).toBe('2');
    expect(machine.getContext().total).toBe(29.99);
  });

  it('should update item quantity', () => {
    const machine = createShoppingMachine();

    machine.send({ type: 'ADD_ITEM', item: { id: '1', name: 'Mouse', price: 29.99 } });
    machine.send({ type: 'UPDATE_QUANTITY', itemId: '1', quantity: 5 });

    expect(machine.getContext().cart[0]?.quantity).toBe(5);
    expect(machine.getContext().total).toBeCloseTo(149.95, 2);
  });

  it('should apply discount', () => {
    const machine = createShoppingMachine();

    machine.send({ type: 'APPLY_DISCOUNT', percent: 10 });

    expect(machine.getContext().discount).toBe(10);
  });

  it('should login user', () => {
    const machine = createShoppingMachine();

    machine.send({ type: 'LOGIN', user: { name: 'John Doe', email: 'john@example.com' } });

    expect(machine.getContext().user).toEqual({ name: 'John Doe', email: 'john@example.com' });
  });

  it('should logout user', () => {
    const machine = createShoppingMachine();

    machine.send({ type: 'LOGIN', user: { name: 'John Doe', email: 'john@example.com' } });
    machine.send({ type: 'LOGOUT' });

    expect(machine.getContext().user).toBeNull();
  });

  it('should transition to checkout state', () => {
    const machine = createShoppingMachine();

    machine.send({ type: 'ADD_ITEM', item: { id: '1', name: 'Laptop', price: 999.99 } });
    machine.send({ type: 'CHECKOUT' });

    expect(machine.getConfiguration().has('checkout')).toBe(true);
  });

  it('should reset cart after checkout', () => {
    const machine = createShoppingMachine();

    machine.send({ type: 'ADD_ITEM', item: { id: '1', name: 'Laptop', price: 999.99 } });
    machine.send({ type: 'APPLY_DISCOUNT', percent: 10 });
    machine.send({ type: 'CHECKOUT' });
    machine.send({ type: 'RESET' });

    expect(machine.getConfiguration().has('browsing')).toBe(true);
    expect(machine.getContext().cart).toEqual([]);
    expect(machine.getContext().total).toBe(0);
    expect(machine.getContext().discount).toBe(0);
  });

  it('should handle complex shopping scenario', () => {
    const machine = createShoppingMachine();

    // Add items
    machine.send({ type: 'ADD_ITEM', item: { id: '1', name: 'Laptop', price: 999.99 } });
    machine.send({ type: 'ADD_ITEM', item: { id: '2', name: 'Mouse', price: 29.99 } });
    machine.send({ type: 'ADD_ITEM', item: { id: '1', name: 'Laptop', price: 999.99 } }); // 2 laptops

    // Update mouse quantity
    machine.send({ type: 'UPDATE_QUANTITY', itemId: '2', quantity: 3 });

    // Login and apply discount
    machine.send({ type: 'LOGIN', user: { name: 'Alice', email: 'alice@example.com' } });
    machine.send({ type: 'APPLY_DISCOUNT', percent: 15 });

    // Verify final state
    expect(machine.getContext().cart).toHaveLength(2);
    expect(machine.getContext().cart.find((i) => i.id === '1')?.quantity).toBe(2);
    expect(machine.getContext().cart.find((i) => i.id === '2')?.quantity).toBe(3);
    expect(machine.getContext().total).toBeCloseTo(2089.95, 2); // (999.99 * 2) + (29.99 * 3)
    expect(machine.getContext().discount).toBe(15);
    expect(machine.getContext().user?.name).toBe('Alice');
  });

  it('should maintain immutability of original cart', () => {
    const machine = createShoppingMachine();

    machine.send({ type: 'ADD_ITEM', item: { id: '1', name: 'Laptop', price: 999.99 } });
    const cart1 = machine.getContext().cart;

    machine.send({ type: 'ADD_ITEM', item: { id: '2', name: 'Mouse', price: 29.99 } });
    const cart2 = machine.getContext().cart;

    // Original cart should not be modified
    expect(cart1).not.toBe(cart2);
    expect(cart1).toHaveLength(1);
    expect(cart2).toHaveLength(2);
  });
});
