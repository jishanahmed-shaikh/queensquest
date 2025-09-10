import express from 'express';
import { 
  InitResponse, 
  IncrementResponse, 
  DecrementResponse,
  QueensInitResponse,
  QueensMoveResponse,
  QueensCheckResponse,
  QueensResetResponse,
  GameState,
  GameConfig
} from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { 
  createInitialGameState, 
  createDefaultConfig, 
  toggleQueen, 
  updateGameState,
  validateBoard,
  isSolution 
} from '../shared/utils/board';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      const [count, username] = await Promise.all([
        redis.get('count'),
        reddit.getCurrentUsername(),
      ]);

      res.json({
        type: 'init',
        postId: postId,
        count: count ? parseInt(count) : 0,
        username: username ?? 'anonymous',
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error during initialization';
      if (error instanceof Error) {
        errorMessage = `Initialization failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', 1),
      postId,
      type: 'increment',
    });
  }
);

router.post<{ postId: string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', -1),
      postId,
      type: 'decrement',
    });
  }
);

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

// QueensQuest API endpoints
router.get<{ postId: string }, QueensInitResponse | { status: string; message: string }>(
  '/api/queens/init',
  async (req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      console.error('QueensQuest Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      const username = await reddit.getCurrentUsername();
      // Get board size from query parameter, default to 6
      const boardSize = parseInt(req.query.size as string) || 6;
      const gameState = createInitialGameState(boardSize);
      const config = createDefaultConfig(boardSize);

      // Save initial board state to Redis
      const boardKey = `queens_board_${postId}`;
      const sizeKey = `queens_board_size_${postId}`;
      const timerKey = `queens_timer_${postId}`;
      
      await Promise.all([
        redis.set(boardKey, JSON.stringify(gameState.board)),
        redis.set(sizeKey, boardSize.toString()),
        redis.set(timerKey, Date.now().toString()) // Start timer
      ]);

      res.json({
        type: 'queens_init',
        postId: postId,
        username: username ?? 'Player',
        gameState,
        config,
      });
    } catch (error) {
      console.error(`QueensQuest Init Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error during QueensQuest initialization';
      if (error instanceof Error) {
        errorMessage = `QueensQuest initialization failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post<{ postId: string }, QueensMoveResponse | { status: string; message: string }, { row: number; col: number }>(
  '/api/queens/move',
  async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    const { row, col } = req.body;
    if (typeof row !== 'number' || typeof col !== 'number') {
      res.status(400).json({
        status: 'error',
        message: 'row and col must be numbers',
      });
      return;
    }

    try {
      // Get current board state from Redis (fallback to empty board)
      const boardKey = `queens_board_${postId}`;
      const sizeKey = `queens_board_size_${postId}`;
      const boardData = await redis.get(boardKey);
      const sizeData = await redis.get(sizeKey);
      
      let boardSize = sizeData ? parseInt(sizeData) : 6;
      let board = createInitialGameState(boardSize).board;
      
      if (boardData) {
        try {
          board = JSON.parse(boardData);
          // Ensure board size matches stored size
          if (board.length !== boardSize) {
            board = createInitialGameState(boardSize).board;
          }
        } catch (e) {
          console.warn('Failed to parse board data from Redis, using empty board');
          board = createInitialGameState(boardSize).board;
        }
      }

      // Validate move coordinates
      if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid move coordinates',
        });
        return;
      }

      // Make the move
      const newBoard = toggleQueen(board, row, col);
      const gameState = updateGameState(newBoard);
      // Ensure board size is correct
      gameState.boardSize = boardSize;
      const validation = validateBoard(newBoard);

      // Save updated board to Redis
      await redis.set(boardKey, JSON.stringify(newBoard));

      res.json({
        type: 'queens_move',
        postId,
        gameState,
        validation,
      });
    } catch (error) {
      console.error(`QueensQuest Move Error for post ${postId}:`, error);
      res.status(400).json({
        status: 'error',
        message: 'Failed to make move',
      });
    }
  }
);

router.post<{ postId: string }, QueensCheckResponse | { status: string; message: string }, unknown>(
  '/api/queens/check',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    try {
      // Get current board state from Redis
      const boardKey = `queens_board_${postId}`;
      const sizeKey = `queens_board_size_${postId}`;
      const boardData = await redis.get(boardKey);
      const sizeData = await redis.get(sizeKey);
      
      let boardSize = sizeData ? parseInt(sizeData) : 6;
      let board = createInitialGameState(boardSize).board;
      
      if (boardData) {
        try {
          board = JSON.parse(boardData);
          // Ensure board size matches stored size
          if (board.length !== boardSize) {
            board = createInitialGameState(boardSize).board;
          }
        } catch (e) {
          console.warn('Failed to parse board data from Redis, using empty board');
          board = createInitialGameState(boardSize).board;
        }
      }

      const solved = isSolution(board);
      const message = solved 
        ? '🎉 Puzzle Solved! Congratulations!' 
        : '⚠️ Not solved yet. Keep trying!';

      // If solved, calculate score, completion time and save to leaderboard
      let score = 0;
      let completionTime = 0;
      if (solved) {
        const timerKey = `queens_timer_${postId}`;
        const startTime = await redis.get(timerKey);
        if (startTime) {
          completionTime = Date.now() - parseInt(startTime);
        }
        score = boardSize * 100; // Base score based on board size
        const leaderboardKey = 'queens_leaderboard';
        const username = await reddit.getCurrentUsername();
        if (username) {
          await redis.zAdd(leaderboardKey, { score, member: username });
        }
      }

      const response: QueensCheckResponse = {
        type: 'queens_check',
        postId,
        isSolved: solved,
        message,
        ...(solved && { score, completionTime }),
      };
      
      res.json(response);
    } catch (error) {
      console.error(`QueensQuest Check Error for post ${postId}:`, error);
      res.status(400).json({
        status: 'error',
        message: 'Failed to check solution',
      });
    }
  }
);

// QueensQuest Reset endpoint
router.post<{ postId: string }, { status: string; message: string } | { type: 'queens_reset'; postId: string; gameState: GameState; config: GameConfig }, { boardSize?: number }>(
  '/api/queens/reset',
  async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    try {
      const { boardSize = 6 } = req.body; // Default to 6x6
      const gameState = createInitialGameState(boardSize);
      const config = createDefaultConfig(boardSize);

      // Clear all Redis data for this session
      const boardKey = `queens_board_${postId}`;
      const sizeKey = `queens_board_size_${postId}`;
      const timerKey = `queens_timer_${postId}`;
      
      await Promise.all([
        redis.del(boardKey),
        redis.del(sizeKey),
        redis.del(timerKey),
        redis.set(boardKey, JSON.stringify(gameState.board)),
        redis.set(sizeKey, boardSize.toString()),
        redis.set(timerKey, Date.now().toString()) // Start new timer
      ]);

      res.json({
        type: 'queens_reset',
        postId,
        gameState,
        config,
      });
    } catch (error) {
      console.error(`QueensQuest Reset Error for post ${postId}:`, error);
      res.status(400).json({
        status: 'error',
        message: 'Failed to reset game',
      });
    }
  }
);

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
