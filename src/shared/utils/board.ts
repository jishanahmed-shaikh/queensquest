/**
 * Board utilities for N-Queens puzzle logic
 */

import type { Board, Position, GameState, ValidationResult, GameConfig } from '../types/queens';

/**
 * Creates an empty N×N board
 */
export const createEmptyBoard = (size: number): Board => {
  return Array(size).fill(null).map(() => Array(size).fill(false));
};

/**
 * Creates initial game state
 */
export const createInitialGameState = (boardSize: number): GameState => {
  return {
    board: createEmptyBoard(boardSize),
    boardSize,
    isSolved: false,
    hasConflicts: false,
    queenCount: 0,
  };
};

/**
 * Creates default game configuration
 */
export const createDefaultConfig = (boardSize: number = 5): GameConfig => {
  return {
    boardSize,
    difficulty: boardSize <= 5 ? 'easy' : boardSize <= 6 ? 'medium' : 'hard',
    showHints: true,
  };
};

/**
 * Toggles a queen at the specified position
 */
export const toggleQueen = (board: Board, row: number, col: number): Board => {
  const newBoard = board.map(row => [...row]);
  newBoard[row][col] = !newBoard[row][col];
  return newBoard;
};

/**
 * Counts the number of queens on the board
 */
export const countQueens = (board: Board): number => {
  return board.flat().filter(cell => cell).length;
};

/**
 * Checks if a position is safe (no conflicts with other queens)
 * This function checks if placing a queen at the given position would conflict with existing queens
 */
export const isPositionSafe = (board: Board, row: number, col: number): boolean => {
  const size = board.length;
  
  // Check row
  for (let c = 0; c < size; c++) {
    if (c !== col && board[row][c]) {
      return false;
    }
  }
  
  // Check column
  for (let r = 0; r < size; r++) {
    if (r !== row && board[r][col]) {
      return false;
    }
  }
  
  // Check diagonals
  // Top-left to bottom-right diagonal
  for (let i = 0; i < size; i++) {
    const r = row - col + i;
    const c = i;
    if (r >= 0 && r < size && c >= 0 && c < size && r !== row && c !== col && board[r][c]) {
      return false;
    }
  }
  
  // Top-right to bottom-left diagonal
  for (let i = 0; i < size; i++) {
    const r = row + col - i;
    const c = i;
    if (r >= 0 && r < size && c >= 0 && c < size && r !== row && c !== col && board[r][c]) {
      return false;
    }
  }
  
  return true;
};

/**
 * Finds all conflicting positions on the board
 */
export const findConflicts = (board: Board): Position[] => {
  const conflicts: Position[] = [];
  const size = board.length;
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col]) {
        // Check if this queen conflicts with others
        // We need to check conflicts by temporarily removing this queen
        const tempBoard = board.map(r => [...r]);
        tempBoard[row][col] = false;
        
        if (!isPositionSafe(tempBoard, row, col)) {
          conflicts.push({ row, col });
        }
      }
    }
  }
  
  return conflicts;
};

/**
 * Validates the current board state
 */
export const validateBoard = (board: Board): ValidationResult => {
  const conflicts = findConflicts(board);
  const queenCount = countQueens(board);
  const boardSize = board.length;
  
  if (conflicts.length > 0) {
    return {
      isValid: false,
      conflicts,
      message: `❌ Conflict detected! ${conflicts.length} queen(s) are under attack.`,
    };
  }
  
  if (queenCount === boardSize) {
    return {
      isValid: true,
      conflicts: [],
      message: '🎉 Puzzle Solved! All queens are placed safely.',
    };
  }
  
  if (queenCount < boardSize) {
    return {
      isValid: true,
      conflicts: [],
      message: `✅ Safe so far. ${queenCount}/${boardSize} queens placed.`,
    };
  }
  
  return {
    isValid: false,
    conflicts: [],
    message: '⚠️ Too many queens placed.',
  };
};

/**
 * Checks if the board is a valid solution to the N-Queens problem
 */
export const isSolution = (board: Board): boolean => {
  const validation = validateBoard(board);
  return validation.isValid && countQueens(board) === board.length;
};

/**
 * Updates game state after a move
 */
export const updateGameState = (board: Board): GameState => {
  const validation = validateBoard(board);
  const queenCount = countQueens(board);
  const boardSize = board.length;
  
  return {
    board,
    boardSize,
    isSolved: validation.isValid && queenCount === boardSize,
    hasConflicts: validation.conflicts.length > 0,
    queenCount,
  };
};
