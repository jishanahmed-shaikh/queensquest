/**
 * Custom hook for managing QueensQuest game state and logic
 */

import { useCallback, useEffect, useState } from 'react';
import type { 
  QueensInitResponse, 
  QueensMoveResponse, 
  QueensCheckResponse,
  QueensResetResponse,
  GameState, 
  GameConfig,
  ValidationResult 
} from '../../shared/types/api';
import { 
  createInitialGameState, 
  createDefaultConfig, 
  toggleQueen, 
  updateGameState,
  validateBoard,
  isSolution 
} from '../../shared/utils/board';

interface QueensGameState {
  gameState: GameState;
  config: GameConfig;
  username: string | null;
  loading: boolean;
  validation: ValidationResult;
  startTime: number | null;
  completionTime: number | null;
  showCelebration: boolean;
}

export const useQueensGame = () => {
  // Read preferred size from localStorage (fallback to 6)
  const initialSize = (() => {
    try {
      const saved = Number(localStorage.getItem('qq.boardSize') ?? '6');
      return Number.isNaN(saved) ? 6 : Math.min(Math.max(saved, 4), 12);
    } catch {
      return 6;
    }
  })();

  const [state, setState] = useState<QueensGameState>({
    gameState: createInitialGameState(initialSize),
    config: createDefaultConfig(initialSize),
    username: null,
    loading: true,
    validation: { isValid: true, conflicts: [], message: '✅ Safe so far.' },
    startTime: null,
    completionTime: null,
    showCelebration: false,
  });
  const [postId, setPostId] = useState<string | null>(null);

  // Initialize game (respect saved size)
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`/api/queens/init?size=${state.config.boardSize}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: QueensInitResponse = await res.json();
        if (data.type !== 'queens_init') throw new Error('Unexpected response');
        
        setState(prev => ({
          ...prev,
          gameState: data.gameState,
          config: data.config,
          username: data.username,
          loading: false,
          validation: validateBoard(data.gameState.board),
          // Do not start timer until first move
          startTime: null,
          completionTime: null,
          showCelebration: false,
        }));
        setPostId(data.postId);
      } catch (err) {
        console.error('Failed to init QueensQuest game', err);
        // Fallback to local state if server fails
        setState(prev => ({
          ...prev,
          loading: false,
          username: 'Player',
          gameState: createInitialGameState(state.config.boardSize),
          config: createDefaultConfig(state.config.boardSize),
          validation: validateBoard(createInitialGameState(state.config.boardSize).board),
          startTime: null,
          completionTime: null,
        }));
      }
    };
    void init();
  }, []);

  // Toggle queen at position (optimistic)
  const toggleQueenAt = useCallback(
    async (row: number, col: number) => {
      // Optimistic local update for snappy UI
      let optimisticBoard: boolean[][] | null = null;
      setState(prev => {
        const hasStarted = prev.startTime !== null;
        const newBoard = toggleQueen(prev.gameState.board, row, col);
        optimisticBoard = newBoard;
        const newGameState = updateGameState(newBoard);
        newGameState.boardSize = prev.gameState.boardSize;
        const newValidation = validateBoard(newBoard);
        return {
          ...prev,
          gameState: newGameState,
          validation: newValidation,
          startTime: hasStarted ? prev.startTime : Date.now(),
          completionTime: newGameState.isSolved ? prev.completionTime : null,
        };
      });

      if (!postId) {
        console.error('No postId – cannot sync move to server');
        return;
      }

      try {
        const res = await fetch('/api/queens/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ row, col }),
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: QueensMoveResponse = await res.json();
        
        // Reconcile with server state (in case conflicts/rules differ)
        setState(prev => ({
          ...prev,
          gameState: data.gameState,
          validation: data.validation,
          startTime: prev.startTime ?? Date.now(),
          completionTime: data.gameState.isSolved ? prev.completionTime : null,
        }));
      } catch (err) {
        console.error('Failed to sync move', err);
        // Keep optimistic state; optionally could roll back if critical
      }
    },
    [postId]
  );

  // Check if current board is a solution
  const checkSolution = useCallback(async () => {
    if (!postId) {
      console.error('No postId – cannot check solution');
      // Fallback to local validation
      const isSolvedLocal = isSolution(state.gameState.board);
      const messageLocal = isSolvedLocal 
        ? '🎉 Puzzle Solved!' 
        : '⚠️ Not solved yet.';
      setState(prev => ({
        ...prev,
        gameState: { ...prev.gameState, isSolved: isSolvedLocal },
        validation: { 
          isValid: isSolvedLocal, 
          conflicts: [], 
          message: messageLocal,
        },
        completionTime: isSolvedLocal && prev.startTime ? (Date.now() - prev.startTime) : null,
        showCelebration: isSolvedLocal,
      }));
      return;
    }

    try {
      const res = await fetch('/api/queens/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: QueensCheckResponse = await res.json();
      
      setState(prev => ({
        ...prev,
        gameState: { ...prev.gameState, isSolved: data.isSolved },
        validation: { 
          isValid: data.isSolved, 
          conflicts: [], 
          message: data.message 
        },
        completionTime: data.isSolved
          ? (typeof data.completionTime === 'number' && data.completionTime > 0
              ? data.completionTime
              : (prev.startTime ? Date.now() - prev.startTime : null))
          : null,
        showCelebration: data.isSolved,
      }));
    } catch (err) {
      console.error('Failed to check solution', err);
      // Fallback to local validation
      const isSolvedLocal = isSolution(state.gameState.board);
      const messageLocal = isSolvedLocal 
        ? '🎉 Puzzle Solved!' 
        : '⚠️ Not solved yet.';
      
      setState(prev => ({
        ...prev,
        gameState: { ...prev.gameState, isSolved: isSolvedLocal },
        validation: { 
          isValid: isSolvedLocal, 
          conflicts: [], 
          message: messageLocal 
        },
        completionTime: isSolvedLocal && prev.startTime ? (Date.now() - prev.startTime) : null,
        showCelebration: isSolvedLocal,
      }));
    }
  }, [postId, state.gameState.board]);

  // Reset game (does not start timer until first move)
  const resetGame = useCallback(async () => {
    if (!postId) {
      console.error('No postId – cannot reset game');
      // Fallback to local reset
      const newGameState = createInitialGameState(state.config.boardSize);
      const newValidation = validateBoard(newGameState.board);
      setState(prev => ({
        ...prev,
        gameState: newGameState,
        validation: newValidation,
        startTime: null,
        completionTime: null,
        showCelebration: false,
      }));
      return;
    }

    try {
      const res = await fetch('/api/queens/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardSize: state.config.boardSize }),
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: QueensResetResponse = await res.json();
      
      setState(prev => ({
        ...prev,
        gameState: data.gameState,
        config: data.config,
        loading: false,
        validation: validateBoard(data.gameState.board),
        startTime: null,
        completionTime: null,
        showCelebration: false,
      }));
    } catch (err) {
      console.error('Failed to reset game', err);
      // Fallback to local reset
      const newGameState = createInitialGameState(state.config.boardSize);
      const newValidation = validateBoard(newGameState.board);
      
      setState(prev => ({
        ...prev,
        gameState: newGameState,
        validation: newValidation,
        startTime: null,
        completionTime: null,
        showCelebration: false,
      }));
    }
  }, [postId, state.config.boardSize]);

  // Change board size (does not start timer until first move)
  const changeBoardSize = useCallback(async (newSize: number) => {
    if (!postId) {
      console.error('No postId – cannot change board size');
      // Fallback to local state update
      const newGameState = createInitialGameState(newSize);
      const newConfig = createDefaultConfig(newSize);
      const newValidation = validateBoard(newGameState.board);
      setState(prev => ({
        ...prev,
        gameState: newGameState,
        config: newConfig,
        validation: newValidation,
        startTime: null,
        completionTime: null,
        showCelebration: false,
      }));
      try { localStorage.setItem('qq.boardSize', String(newSize)); } catch {}
      return;
    }

    try {
      const res = await fetch(`/api/queens/init?size=${newSize}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: QueensInitResponse = await res.json();
      if (data.type !== 'queens_init') throw new Error('Unexpected response');
      
      setState(prev => ({
        ...prev,
        gameState: data.gameState,
        config: data.config,
        username: data.username,
        loading: false,
        validation: validateBoard(data.gameState.board),
        startTime: null,
        completionTime: null,
        showCelebration: false,
      }));
      try { localStorage.setItem('qq.boardSize', String(newSize)); } catch {}
    } catch (err) {
      console.error('Failed to change board size', err);
      // Fallback to local state update
      const newGameState = createInitialGameState(newSize);
      const newConfig = createDefaultConfig(newSize);
      const newValidation = validateBoard(newGameState.board);
      
      setState(prev => ({
        ...prev,
        gameState: newGameState,
        config: newConfig,
        validation: newValidation,
        startTime: null,
        completionTime: null,
        showCelebration: false,
      }));
      try { localStorage.setItem('qq.boardSize', String(newSize)); } catch {}
    }
  }, [postId]);

  // Hide celebration
  const hideCelebration = useCallback(() => {
    setState(prev => ({
      ...prev,
      showCelebration: false,
    }));
  }, []);

  return {
    ...state,
    toggleQueenAt,
    checkSolution,
    resetGame,
    changeBoardSize,
    hideCelebration,
  } as const;
};
