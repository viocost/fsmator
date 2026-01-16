/**
 * Example: Context Changes
 * Demonstrates various context update patterns and immutability
 */

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

export function runContextChangesExample() {
  console.log('\n' + '='.repeat(80));
  console.log('Example 4: Context Changes (Shopping Cart)');
  console.log('='.repeat(80));

  const config: StateMachineConfig<ShoppingContext, ShoppingEvent> = {
    initial: 'browsing',
    debug: true,
    initialContext: {
      cart: [],
      total: 0,
      discount: 0,
      user: null,
    },
    states: {
      browsing: {
        onEntry: ['logBrowsing'],
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
        onEntry: ['logCheckout'],
        on: {
          RESET: { target: 'browsing', assign: 'resetCart' },
        },
      },
    },
    reducers: {
      logBrowsing: () => {
        console.log('    [App] User is browsing');
        return {};
      },
      logCheckout: ({ context }) => {
        const finalTotal = context.total * (1 - context.discount / 100);
        console.log(`    [App] Checking out with total: $${finalTotal.toFixed(2)}`);
        return {};
      },
      addItem: ({ context, event }) => {
        if (event.type !== 'ADD_ITEM') return {};

        // Immutably add item to cart
        const existingItemIndex = context.cart.findIndex((i) => i.id === event.item.id);

        let newCart;
        if (existingItemIndex >= 0) {
          // Update quantity of existing item
          newCart = context.cart.map((item, idx) =>
            idx === existingItemIndex ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          // Add new item
          newCart = [...context.cart, { ...event.item, quantity: 1 }];
        }

        const newTotal = newCart.reduce((sum, item) => sum + item.price * item.quantity, 0);

        return { cart: newCart, total: newTotal };
      },
      removeItem: ({ context, event }) => {
        if (event.type !== 'REMOVE_ITEM') return {};

        // Immutably remove item from cart
        const newCart = context.cart.filter((item) => item.id !== event.itemId);
        const newTotal = newCart.reduce((sum, item) => sum + item.price * item.quantity, 0);

        return { cart: newCart, total: newTotal };
      },
      updateQuantity: ({ context, event }) => {
        if (event.type !== 'UPDATE_QUANTITY') return {};

        // Immutably update item quantity
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

  const machine = new StateMachine(config);

  console.log('\n--- Adding items to cart ---');
  machine.send({ type: 'ADD_ITEM', item: { id: '1', name: 'Laptop', price: 999.99 } });
  machine.send({ type: 'ADD_ITEM', item: { id: '2', name: 'Mouse', price: 29.99 } });
  machine.send({ type: 'ADD_ITEM', item: { id: '1', name: 'Laptop', price: 999.99 } }); // Add another laptop

  console.log('\n--- Updating quantity ---');
  machine.send({ type: 'UPDATE_QUANTITY', itemId: '2', quantity: 3 }); // 3 mice

  console.log('\n--- Login and apply discount ---');
  machine.send({ type: 'LOGIN', user: { name: 'John Doe', email: 'john@example.com' } });
  machine.send({ type: 'APPLY_DISCOUNT', percent: 10 }); // 10% off

  console.log('\n--- Checkout ---');
  machine.send({ type: 'CHECKOUT' });

  console.log('\n--- Final State ---');
  console.log('Configuration:', Array.from(machine.getActiveStateNodes()));
  console.log('Context:', machine.getContext());
}
