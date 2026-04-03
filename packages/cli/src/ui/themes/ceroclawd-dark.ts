/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import type { SemanticColors } from './semantic-tokens.js';

const ceroclawdDarkColors: ColorsTheme = {
  type: 'dark',
  Background: '#0a0a0a',
  Foreground: '#f0ede8',
  LightBlue: '#7eb8da',
  AccentBlue: '#39BAE6',
  AccentPurple: '#c490f5',
  AccentCyan: '#6ee7b7',
  AccentGreen: '#00e676',  // website brand green
  AccentYellow: '#f5c542',
  AccentRed: '#ef4444',    // website red
  AccentYellowDim: '#8B7530',
  AccentRedDim: '#7a1f1f',
  DiffAdded: '#00e676',
  DiffRemoved: '#ef4444',
  Comment: '#4a5568',
  Gray: '#4a5060',
  GradientColors: ['#9b59b6', '#c490f5', '#e8b4fe'], // keep purple gradient
};

// Semantic colors wired to ceroclawdDarkColors — not the generic darkTheme
const ceroclawdSemanticColors: SemanticColors = {
  text: {
    primary: ceroclawdDarkColors.Foreground,
    secondary: ceroclawdDarkColors.Gray,
    link: ceroclawdDarkColors.AccentGreen,    // green links (brand color)
    accent: ceroclawdDarkColors.AccentPurple, // purple accents (keep violet)
    code: ceroclawdDarkColors.LightBlue,
  },
  background: {
    primary: ceroclawdDarkColors.Background,
    diff: {
      added: ceroclawdDarkColors.DiffAdded,
      removed: ceroclawdDarkColors.DiffRemoved,
    },
  },
  border: {
    default: ceroclawdDarkColors.AccentPurple, // purple borders (brand violet)
    focused: ceroclawdDarkColors.AccentGreen,  // green when focused (website green)
  },
  ui: {
    comment: ceroclawdDarkColors.Comment,
    symbol: ceroclawdDarkColors.Gray,
    gradient: ceroclawdDarkColors.GradientColors,
  },
  status: {
    error: ceroclawdDarkColors.AccentRed,
    success: ceroclawdDarkColors.AccentGreen,
    warning: ceroclawdDarkColors.AccentYellow,
    errorDim: ceroclawdDarkColors.AccentRedDim,
    warningDim: ceroclawdDarkColors.AccentYellowDim,
  },
};

export const CeroclawdDark: Theme = new Theme(
  'Ceroclawd Dark',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: ceroclawdDarkColors.Background,
      color: ceroclawdDarkColors.Foreground,
    },
    'hljs-keyword': {
      color: ceroclawdDarkColors.AccentYellow,
    },
    'hljs-literal': {
      color: ceroclawdDarkColors.AccentPurple,
    },
    'hljs-symbol': {
      color: ceroclawdDarkColors.AccentCyan,
    },
    'hljs-name': {
      color: ceroclawdDarkColors.LightBlue,
    },
    'hljs-link': {
      color: ceroclawdDarkColors.AccentBlue,
    },
    'hljs-function .hljs-keyword': {
      color: ceroclawdDarkColors.AccentYellow,
    },
    'hljs-subst': {
      color: ceroclawdDarkColors.Foreground,
    },
    'hljs-string': {
      color: ceroclawdDarkColors.AccentGreen,
    },
    'hljs-title': {
      color: ceroclawdDarkColors.AccentYellow,
    },
    'hljs-type': {
      color: ceroclawdDarkColors.AccentBlue,
    },
    'hljs-attribute': {
      color: ceroclawdDarkColors.AccentYellow,
    },
    'hljs-bullet': {
      color: ceroclawdDarkColors.AccentYellow,
    },
    'hljs-addition': {
      color: ceroclawdDarkColors.AccentGreen,
    },
    'hljs-variable': {
      color: ceroclawdDarkColors.Foreground,
    },
    'hljs-template-tag': {
      color: ceroclawdDarkColors.AccentYellow,
    },
    'hljs-template-variable': {
      color: ceroclawdDarkColors.AccentYellow,
    },
    'hljs-comment': {
      color: ceroclawdDarkColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: ceroclawdDarkColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-deletion': {
      color: ceroclawdDarkColors.AccentRed,
    },
    'hljs-meta': {
      color: ceroclawdDarkColors.AccentYellow,
    },
    'hljs-doctag': {
      fontWeight: 'bold',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
  },
  ceroclawdDarkColors,
  ceroclawdSemanticColors,
);
