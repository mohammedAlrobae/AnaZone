'use client';

import React from 'react';
import { type AgentState } from '@livekit/components-react';
import { AgentAudioVisualizerWave } from '@/components/agents-ui/agent-audio-visualizer-wave';
import type { LocalAudioTrack, RemoteAudioTrack } from 'livekit-client';

/**
 * Exact Visualizer Configurations defined by the user for each state:
 * - speaking:   blue    (#0026ff), colorShift: 1.98, lineWidth: 1.6
 * - connecting: green   (#1eff00), colorShift: 2.00, lineWidth: 1.9
 * - listening:  orange  (#ff5500), colorShift: 1.06, lineWidth: 3.8
 * - thinking:   magenta (#ff00e1), colorShift: 0.88, lineWidth: 3.0
 */
export const AGENT_WAVE_CONFIGS: Record<
  string,
  { color: `#${string}`; colorShift: number; lineWidth: number }
> = {
  disconnected: {
    color: '#ff2222',
    colorShift: 0.0,
    lineWidth: 2.2,
  },
  ready: {
    color: '#10b981',
    colorShift: 0.0,
    lineWidth: 1.8,
  },
  speaking: {
    color: '#0026ff',
    colorShift: 0.0,
    lineWidth: 1.6,
  },
  connecting: {
    color: '#1eff00',
    colorShift: 0.0,
    lineWidth: 1.9,
  },
  listening: {
    color: '#ff5500',
    colorShift: 0.0,
    lineWidth: 3.8,
  },
  thinking: {
    color: '#ff00e1',
    colorShift: 0.0,
    lineWidth: 3.0,
  },
};

export type ExtendedAgentState =
  | AgentState
  | 'disconnected'
  | 'connecting'
  | 'ready'
  | 'listening'
  | 'thinking'
  | 'speaking';

export interface LiveAgentWaveProps {
  /** The current agent state */
  state?: ExtendedAgentState;
  /** Visualizer size */
  size?: 'icon' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Optional audio track for reactive frequency response */
  audioTrack?: LocalAudioTrack | RemoteAudioTrack | any;
  /** Volume level override (0 to 1) */
  volume?: number;
  /** Custom CSS class */
  className?: string;
}

export function LiveAgentWave({
  state = 'disconnected',
  size = 'full',
  audioTrack,
  volume,
  className = 'w-full h-full',
}: LiveAgentWaveProps) {
  const config = AGENT_WAVE_CONFIGS[state] || AGENT_WAVE_CONFIGS.disconnected;
  const liveKitState = (state === 'ready' ? 'listening' : state) as AgentState;

  return (
    <AgentAudioVisualizerWave
      size={size}
      color={config.color}
      colorShift={config.colorShift}
      lineWidth={config.lineWidth}
      state={liveKitState}
      audioTrack={audioTrack}
      volume={volume}
      className={className}
    />
  );
}

export default LiveAgentWave;
