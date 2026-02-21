import { AssignEntry, GuardEntry, BaseEvent, StateContext } from './types';

export const defineAssigns = <Context extends StateContext, Event extends BaseEvent>(assigns: {
  [K: string]: AssignEntry<Context, Event>;
}) => {
  const result: Record<string, AssignEntry<Context, Event>> = {};

  for (const [key, entry] of Object.entries(assigns)) {
    if (typeof entry === 'function') {
      result[key] = entry;
    } else {
      result[key] = entry.handler as AssignEntry<Context, Event>;
    }
  }

  return result;
};

export const defineGuards = <Context extends StateContext, Event extends BaseEvent>(guards: {
  [K: string]: GuardEntry<Context, Event>;
}) => {
  const result: Record<string, GuardEntry<Context, Event>> = {};

  for (const [key, entry] of Object.entries(guards)) {
    if (typeof entry === 'function') {
      result[key] = entry;
    } else {
      result[key] = entry.handler as GuardEntry<Context, Event>;
    }
  }

  return result;
};
