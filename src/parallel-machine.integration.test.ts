/**
 * Integration tests for parallel-machine example
 */

import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/state-machine';
import type { StateMachineConfig } from '../src/types';

type MediaContext = {
  volume: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
};

type MediaEvent =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'VOLUME_UP' }
  | { type: 'VOLUME_DOWN' }
  | { type: 'MUTE' }
  | { type: 'UNMUTE' };

describe('Parallel Machine Integration (Media Player)', () => {
  function createMediaMachine() {
    const config: StateMachineConfig<MediaContext, MediaEvent> = {
      initial: 'player',
      debug: false,
      initialContext: {
        volume: 50,
        currentTime: 0,
        duration: 180,
        isPlaying: false,
      },
      states: {
        player: {
          states: {
            playback: {
              initial: 'stopped',
              states: {
                stopped: {
                  on: {
                    PLAY: { target: 'playing', assign: 'setPlaying' },
                  },
                },
                playing: {
                  on: {
                    PAUSE: { target: 'paused', assign: 'setPaused' },
                    STOP: { target: 'stopped', assign: 'setStopped' },
                  },
                },
                paused: {
                  on: {
                    PLAY: { target: 'playing', assign: 'setPlaying' },
                    STOP: { target: 'stopped', assign: 'setStopped' },
                  },
                },
              },
            },
            volume: {
              initial: 'normal',
              states: {
                normal: {
                  on: {
                    VOLUME_UP: { assign: 'increaseVolume' },
                    VOLUME_DOWN: { assign: 'decreaseVolume' },
                    MUTE: 'muted',
                  },
                },
                muted: {
                  on: {
                    UNMUTE: 'normal',
                  },
                },
              },
            },
          },
        },
      },
      reducers: {
        setPlaying: () => ({ isPlaying: true }),
        setPaused: () => ({ isPlaying: false }),
        setStopped: () => ({ isPlaying: false, currentTime: 0 }),
        increaseVolume: ({ context }) => ({
          volume: Math.min(100, context.volume + 10),
        }),
        decreaseVolume: ({ context }) => ({
          volume: Math.max(0, context.volume - 10),
        }),
      },
    };

    return new StateMachine(config).start();
  }

  it('should initialize with both parallel regions active', () => {
    const machine = createMediaMachine();

    expect(machine.getConfiguration().has('player')).toBe(true);
    expect(machine.getConfiguration().has('player.playback.stopped')).toBe(true);
    expect(machine.getConfiguration().has('player.volume.normal')).toBe(true);
  });

  it('should transition playback from stopped to playing', () => {
    const machine = createMediaMachine();

    machine.send({ type: 'PLAY' });

    expect(machine.getConfiguration().has('player.playback.playing')).toBe(true);
    expect(machine.getContext().isPlaying).toBe(true);
  });

  it('should transition playback from playing to paused', () => {
    const machine = createMediaMachine();

    machine.send({ type: 'PLAY' });
    machine.send({ type: 'PAUSE' });

    expect(machine.getConfiguration().has('player.playback.paused')).toBe(true);
    expect(machine.getContext().isPlaying).toBe(false);
  });

  it('should transition playback from paused to playing', () => {
    const machine = createMediaMachine();

    machine.send({ type: 'PLAY' });
    machine.send({ type: 'PAUSE' });
    machine.send({ type: 'PLAY' });

    expect(machine.getConfiguration().has('player.playback.playing')).toBe(true);
    expect(machine.getContext().isPlaying).toBe(true);
  });

  it('should stop playback and reset currentTime', () => {
    const machine = createMediaMachine();

    machine.send({ type: 'PLAY' });
    machine.send({ type: 'STOP' });

    expect(machine.getConfiguration().has('player.playback.stopped')).toBe(true);
    expect(machine.getContext().isPlaying).toBe(false);
    expect(machine.getContext().currentTime).toBe(0);
  });

  it('should increase volume independently of playback state', () => {
    const machine = createMediaMachine();

    expect(machine.getContext().volume).toBe(50);

    machine.send({ type: 'VOLUME_UP' });
    expect(machine.getContext().volume).toBe(60);

    machine.send({ type: 'VOLUME_UP' });
    expect(machine.getContext().volume).toBe(70);

    // Volume state should remain normal
    expect(machine.getConfiguration().has('player.volume.normal')).toBe(true);
    // Playback state should remain stopped
    expect(machine.getConfiguration().has('player.playback.stopped')).toBe(true);
  });

  it('should decrease volume independently of playback state', () => {
    const machine = createMediaMachine();

    expect(machine.getContext().volume).toBe(50);

    machine.send({ type: 'VOLUME_DOWN' });
    expect(machine.getContext().volume).toBe(40);

    machine.send({ type: 'VOLUME_DOWN' });
    expect(machine.getContext().volume).toBe(30);
  });

  it('should not exceed maximum volume', () => {
    const machine = createMediaMachine();

    // Max out volume
    for (let i = 0; i < 10; i++) {
      machine.send({ type: 'VOLUME_UP' });
    }

    expect(machine.getContext().volume).toBe(100);

    // Try to go higher
    machine.send({ type: 'VOLUME_UP' });
    expect(machine.getContext().volume).toBe(100);
  });

  it('should not go below minimum volume', () => {
    const machine = createMediaMachine();

    // Min out volume
    for (let i = 0; i < 10; i++) {
      machine.send({ type: 'VOLUME_DOWN' });
    }

    expect(machine.getContext().volume).toBe(0);

    // Try to go lower
    machine.send({ type: 'VOLUME_DOWN' });
    expect(machine.getContext().volume).toBe(0);
  });

  it('should mute and unmute independently of playback', () => {
    const machine = createMediaMachine();

    machine.send({ type: 'MUTE' });
    expect(machine.getConfiguration().has('player.volume.muted')).toBe(true);

    machine.send({ type: 'UNMUTE' });
    expect(machine.getConfiguration().has('player.volume.normal')).toBe(true);

    // Playback state should remain stopped
    expect(machine.getConfiguration().has('player.playback.stopped')).toBe(true);
  });

  it('should handle playback and volume changes simultaneously', () => {
    const machine = createMediaMachine();

    // Start playing
    machine.send({ type: 'PLAY' });
    expect(machine.getConfiguration().has('player.playback.playing')).toBe(true);

    // Increase volume while playing
    machine.send({ type: 'VOLUME_UP' });
    expect(machine.getContext().volume).toBe(60);
    expect(machine.getConfiguration().has('player.playback.playing')).toBe(true);

    // Mute while playing
    machine.send({ type: 'MUTE' });
    expect(machine.getConfiguration().has('player.volume.muted')).toBe(true);
    expect(machine.getConfiguration().has('player.playback.playing')).toBe(true);

    // Pause while muted
    machine.send({ type: 'PAUSE' });
    expect(machine.getConfiguration().has('player.playback.paused')).toBe(true);
    expect(machine.getConfiguration().has('player.volume.muted')).toBe(true);
  });

  it('should maintain volume changes across playback state changes', () => {
    const machine = createMediaMachine();

    machine.send({ type: 'VOLUME_UP' });
    machine.send({ type: 'VOLUME_UP' });
    expect(machine.getContext().volume).toBe(70);

    machine.send({ type: 'PLAY' });
    expect(machine.getContext().volume).toBe(70);

    machine.send({ type: 'PAUSE' });
    expect(machine.getContext().volume).toBe(70);

    machine.send({ type: 'STOP' });
    expect(machine.getContext().volume).toBe(70);
  });

  it('should maintain playback state across volume changes', () => {
    const machine = createMediaMachine();

    machine.send({ type: 'PLAY' });
    expect(machine.getContext().isPlaying).toBe(true);

    machine.send({ type: 'VOLUME_UP' });
    expect(machine.getContext().isPlaying).toBe(true);

    machine.send({ type: 'MUTE' });
    expect(machine.getContext().isPlaying).toBe(true);

    machine.send({ type: 'UNMUTE' });
    expect(machine.getContext().isPlaying).toBe(true);
  });
});
