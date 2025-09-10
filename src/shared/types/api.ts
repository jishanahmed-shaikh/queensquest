// Legacy counter app types (keeping for compatibility)
export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

// Re-export QueensQuest types
export type {
  QueensInitResponse,
  QueensMoveResponse,
  QueensCheckResponse,
  QueensResetResponse,
  GameState,
  Board,
  Position,
  ValidationResult,
  GameConfig,
  Difficulty,
} from './queens';
