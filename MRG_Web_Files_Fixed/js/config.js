/**
 * MRG Experiment - Configuration
 * Conditions, payoff matrices, and game constants
 */

const CONFIG = {
  AI_THINKING_MIN: 4500,
  AI_THINKING_MAX: 8000,
  MATCHING_DELAY_MIN: 6000,
  MATCHING_DELAY_MAX: 12000,
  MATCHED_COUNTDOWN: 5,
  TOTAL_ROUNDS: 2,
  // Total progress steps for progress bar
  TOTAL_PROGRESS_STEPS: 25,
  MIN_DWELL_TIME: 10000 // 10 seconds minimum on key screens
};

/**
 * 4 experimental conditions
 * 2 (social framing: high vs low) × 2 (reward clarity: clear vs ambiguous)
 */
const CONDITIONS = {
  1: {
    id: 1,
    socialFraming: 'low',
    rewardClarity: 'ambiguous',
    opponentLabel: 'the AI agent',
    opponentLabelShort: 'AI',
    rewardUnit: 'p',
    rewardUnitFull: 'points',
    formatReward: (amount) => {
      const abs = Math.abs(amount);
      const sign = amount >= 0 ? '+' : '-';
      return `${sign}${abs}p`;
    },
    opponentDescription: `Your opponent in this game is <strong>an AI agent</strong>.<br><br>The AI agent is designed to make the most rational decisions based on its trained algorithm.`,
    rewardDescription: `Your outcomes will be measured in <strong>points (p)</strong>. Points earned during the game will determine your final bonus.`
  },
  2: {
    id: 2,
    socialFraming: 'low',
    rewardClarity: 'clear',
    opponentLabel: 'the AI agent',
    opponentLabelShort: 'AI',
    rewardUnit: '$',
    rewardUnitFull: 'USD ($)',
    formatReward: (amount) => {
      const dollars = Math.abs(amount) / 10;
      const sign = amount >= 0 ? '+' : '-';
      return `${sign}$${dollars}`;
    },
    opponentDescription: `Your opponent in this game is <strong>an AI agent</strong>.<br><br>The AI agent is designed to make the most rational decisions based on its trained algorithm.`,
    rewardDescription: `Your outcomes will be measured in <strong>Dollars ($)</strong>. The money earned during the game will be directly added to your payment.`
  },
  3: {
    id: 3,
    socialFraming: 'high',
    rewardClarity: 'ambiguous',
    opponentLabel: 'the AI agent (operated by a human)',
    opponentLabelShort: 'AI',
    rewardUnit: 'p',
    rewardUnitFull: 'points',
    formatReward: (amount) => {
      const abs = Math.abs(amount);
      const sign = amount >= 0 ? '+' : '-';
      return `${sign}${abs}p`;
    },
    opponentDescription: `Your opponent is <strong>another participant</strong> in this experiment.<br><br>However, your opponent has been assigned <strong>different conditions</strong> from you. Instead of making choices directly, they must <strong>follow the decisions of an AI agent</strong>.<br><br>In other words, when the opponent asks the AI whether to cooperate or defect, they must follow whatever the AI answers.<br><br>The AI agent is designed to make the most rational decisions based on its trained algorithm.<br><br>However, the <strong>rewards earned through the game</strong> go to the <strong>participant themselves</strong>, not the AI.`,
    rewardDescription: `Your outcomes will be measured in <strong>points (p)</strong>. Points earned during the game will determine your final bonus.`
  },
  4: {
    id: 4,
    socialFraming: 'high',
    rewardClarity: 'clear',
    opponentLabel: 'the AI agent (operated by a human)',
    opponentLabelShort: 'AI',
    rewardUnit: '$',
    rewardUnitFull: 'USD ($)',
    formatReward: (amount) => {
      const dollars = Math.abs(amount) / 10;
      const sign = amount >= 0 ? '+' : '-';
      return `${sign}$${dollars}`;
    },
    opponentDescription: `Your opponent is <strong>another participant</strong> in this experiment.<br><br>However, your opponent has been assigned <strong>different conditions</strong> from you. Instead of making choices directly, they must <strong>follow the decisions of an AI agent</strong>.<br><br>In other words, when the opponent asks the AI whether to cooperate or defect, they must follow whatever the AI answers.<br><br>The AI agent is designed to make the most rational decisions based on its trained algorithm.<br><br>However, the <strong>rewards earned through the game</strong> go to the <strong>participant themselves</strong>, not the AI.`,
    rewardDescription: `Your outcomes will be measured in <strong>Dollars ($)</strong>. The money earned during the game will be directly added to your payment.`
  }
};

/**
 * Payoff matrix — matches original MRG design
 * Round 2 = 2× Round 1
 */
const PAYOFFS = {
  1: {
    t1d: { participant: 10, ai: 10 },
    t2d: { participant: -20, ai: 20 },
    cc:  { participant: 20, ai: 20 },
    dc:  { participant: 40, ai: -40 }
  },
  2: {
    t1d: { participant: 20, ai: 20 },
    t2d: { participant: -40, ai: 40 },
    cc:  { participant: 40, ai: 40 },
    dc:  { participant: 80, ai: -80 }
  }
};
