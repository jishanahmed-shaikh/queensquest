/**
 * Types and interfaces for the QueensQuest N-Queens puzzle game
 */

// Board state - 2D array where true means a queen is placed
export type Board = boolean[][];

// Position on the board
export type Position = {
  row: number;
  col: number;
};

// Game state
export type GameState = {
  board: Board;
  boardSize: number;
  isSolved: boolean;
  hasConflicts: boolean;
  queenCount: number;
};

// Validation result
export type ValidationResult = {
  isValid: boolean;
  conflicts: Position[];
  message: string;
};

// Game difficulty levels
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

// Game configuration
export type GameConfig = {
  boardSize: number;
  difficulty: Difficulty;
  showHints: boolean;
};

// API response types for QueensQuest
export type QueensInitResponse = {
  type: 'queens_init';
  postId: string;
  username: string;
  gameState: GameState;
  config: GameConfig;
};

export type QueensMoveResponse = {
  type: 'queens_move';
  postId: string;
  gameState: GameState;
  validation: ValidationResult;
};

export type QueensCheckResponse = {
  type: 'queens_check';
  postId: string;
  isSolved: boolean;
  message: string;
  score?: number;
  completionTime?: number;
};

export type QueensResetResponse = {
  type: 'queens_reset';
  postId: string;
  gameState: GameState;
  config: GameConfig;
};
