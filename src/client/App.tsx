import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueensGame } from './hooks/useQueensGame';
import { Celebration } from './components/Celebration';
import { ShareButtons } from './components/ShareButtons';

// Root webview component for QueensQuest: manages views, audio, and game state
export const App = () => {
	const {
		gameState,
		username,
		loading,
		validation,
		startTime,
		completionTime,
		showCelebration,
		toggleQueenAt,
		resetGame,
		changeBoardSize,
		hideCelebration,
	} = useQueensGame();

	const { board, boardSize, queenCount, isSolved } = gameState;

	// Local view state: controls which screen to show: 'landing' | 'home' | 'game' | 'daily'
	const [view, setView] = useState<'landing' | 'home' | 'game' | 'daily'>('landing');
	const [showInfo, setShowInfo] = useState(false);
	const [isAudioOn, setIsAudioOn] = useState(true);
	const [showLevelComplete, setShowLevelComplete] = useState(false);
	const [completedBoardSize, setCompletedBoardSize] = useState<number | null>(null);
	const [showDailyFailure, setShowDailyFailure] = useState(false);
	const [showDailyCompleted, setShowDailyCompleted] = useState(false);
	const [showCheekyTip, setShowCheekyTip] = useState(false);
	const [countdown, setCountdown] = useState<number | null>(null);
	// Track highest board size the user has completed (streak). Null means NONE yet.
	const [maxStreakSize, setMaxStreakSize] = useState<number | null>(() => {
		try {
			const raw = localStorage.getItem('qq.maxStreakSize');
			if (!raw) return null;
			const num = Number(raw);
			return Number.isNaN(num) ? null : num;
		} catch { return null; }
	});
	const [dailyChallenge, setDailyChallenge] = useState({
		completed: false,
		timeLimit: 30,
		startTime: null as number | null,
		boardSize: 6,
		lastChallengeDate: null as string | null,
	});

	// Helper: current date in IST (YYYY-MM-DD)
	const getISTDateString = () => {
		try {
			return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
		} catch {
			// Fallback if Intl fails
			const now = new Date();
			const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
			const ist = new Date(utc + 330 * 60000);
			const y = ist.getFullYear();
			const m = String(ist.getMonth() + 1).padStart(2, '0');
			const d = String(ist.getDate()).padStart(2, '0');
			return `${y}-${m}-${d}`;
		}
	};

	// Live timer re-render while puzzle active (requestAnimationFrame loop)
	const [, setNowTick] = useState(0);
	const rafRef = useRef<number | null>(null);
	useEffect(() => {
		// Stop timer if no start time, already completed, or puzzle is solved
		if (!startTime || completionTime || isSolved) {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
			return;
		}
		const loop = () => {
			setNowTick(t => (t + 1) % 1000000);
			rafRef.current = requestAnimationFrame(loop);
		};
		rafRef.current = requestAnimationFrame(loop);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		};
	}, [startTime, completionTime, isSolved]);

	// Daily challenge timer logic: shows countdown, failure popup on timeout, resets daily lock at 00:00 IST
	useEffect(() => {
		if (view !== 'daily' || !dailyChallenge.startTime || isSolved || showLevelComplete || dailyChallenge.completed) return;
		
		const interval = setInterval(() => {
			const elapsed = Math.floor((Date.now() - dailyChallenge.startTime!) / 1000);
			const remaining = dailyChallenge.timeLimit - elapsed;
			const todayIST = getISTDateString();
			// If date rolled over to next IST day, clear completion lock
			if (dailyChallenge.lastChallengeDate && dailyChallenge.lastChallengeDate !== todayIST) {
				setDailyChallenge(prev => ({ ...prev, completed: false, lastChallengeDate: null }));
			}
			if (remaining <= 0) {
				// Time's up - show failure popup
				setShowDailyFailure(true);
				// Play lose sound
				playSound(loseRef);
			}
		}, 1000);
		
		return () => clearInterval(interval);
	}, [view, dailyChallenge.startTime, dailyChallenge.lastChallengeDate, dailyChallenge.timeLimit, resetGame, isSolved, showLevelComplete, dailyChallenge.completed]);

	// When solved in daily: mark completed, play completion sound, and show completion overlay
	useEffect(() => {
		if (view === 'daily' && isSolved) {
			const todayIST = getISTDateString();
			setDailyChallenge(prev => ({ ...prev, completed: true, lastChallengeDate: todayIST }));
			playSound(completeRef);
			// Show completion popup instead of alert
			setShowLevelComplete(true);
		}
	}, [view, isSolved, boardSize]);

	// Audio refs
	const bgmRef = useRef<HTMLAudioElement | null>(null);
	const clickRef = useRef<HTMLAudioElement | null>(null);
	const completeRef = useRef<HTMLAudioElement | null>(null);
	const loseRef = useRef<HTMLAudioElement | null>(null);
	const hasTriedAutoplayRef = useRef(false);

	// Restore persisted settings (level, audio) and board size
	useEffect(() => {
		try {
			const savedBoardSize = Number(localStorage.getItem('qq.boardSize') ?? '6');
			if (!Number.isNaN(savedBoardSize) && savedBoardSize >= 4 && savedBoardSize <= 12) {
				void changeBoardSize(savedBoardSize);
			}
			// Restore audio setting or default to ON
			const savedAudio = localStorage.getItem('qq.audioOn');
			setIsAudioOn(savedAudio !== '0');
		} catch {}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Track sources
	const homeBgmSrc = useMemo(() => '/Sounds/LandingPageBG.mp3', []);
	const gameBgmSrc = useMemo(() => '/Sounds/MainGameBG.mp3', []);
	const dailyBgmSrc = useMemo(() => '/Sounds/DailyChallengeBG.mp3', []);
	const clickSrc = useMemo(() => '/Sounds/Click.wav', []);
	const completeSrc = useMemo(() => '/Sounds/PuzzleComplete.wav', []);
	const loseSrc = useMemo(() => '/Sounds/lose.mp3', []);

	// Create audio elements once; preload; no blocking UI on load
	useEffect(() => {
		const initAudio = async () => {
			try {
				bgmRef.current = new Audio();
				bgmRef.current.loop = true;
				bgmRef.current.volume = 0.5; // 50% volume
				bgmRef.current.muted = false; // unmuted per spec
				clickRef.current = new Audio(clickSrc);
				clickRef.current.volume = 0.7;
				completeRef.current = new Audio(completeSrc);
				completeRef.current.volume = 0.7;
				loseRef.current = new Audio(loseSrc);
				loseRef.current.volume = 0.7;
				
				// Preload audio files
				await Promise.all([
					bgmRef.current.load(),
					clickRef.current.load(),
					completeRef.current.load(),
					loseRef.current.load()
				]);
				
				// Try to start playback immediately (may be blocked by browser)
				void bgmRef.current.play().catch(() => {
					// ignore; will retry on first user gesture
				});
				
				// Preloaded assets are ready (UI was never blocked)
			} catch (err) {
				console.warn('Audio preload failed, continuing anyway:', err);
			}
		};
		
		initAudio();
		
		return () => {
			bgmRef.current?.pause();
			bgmRef.current = null;
			clickRef.current = null;
			completeRef.current = null;
			loseRef.current = null;
		};
	}, [clickSrc, completeSrc, loseSrc]);

	// Choose background music by view (home/game/daily) and obey global audio toggle
	useEffect(() => {
		const bgm = bgmRef.current;
		if (!bgm) return;
		// Set source by view
		if (view === 'home' || view === 'landing') {
			if (bgm.src !== window.location.origin + homeBgmSrc) {
				bgm.src = homeBgmSrc;
				bgm.load();
			}
		} else if (view === 'game') {
			if (bgm.src !== window.location.origin + gameBgmSrc) {
				bgm.src = gameBgmSrc;
				bgm.load();
			}
		} else if (view === 'daily') {
			if (bgm.src !== window.location.origin + dailyBgmSrc) {
				bgm.src = dailyBgmSrc;
				bgm.load();
			}
		}

		// Play/pause according to toggle (ensure only one is playing)
		if (isAudioOn) {
			bgm.pause(); // ensure prior src stopped
			void bgm.play().catch(() => {
				hasTriedAutoplayRef.current = false;
			});
		} else {
			bgm.pause();
		}
	}, [view, isAudioOn, homeBgmSrc, gameBgmSrc, dailyBgmSrc]);

	// Start audio on first user interaction if autoplay was blocked
	useEffect(() => {
		const resume = () => {
			if (isAudioOn && bgmRef.current && !hasTriedAutoplayRef.current) {
				hasTriedAutoplayRef.current = true;
				void bgmRef.current.play().catch(() => {});
			}
		};
		window.addEventListener('pointerdown', resume, { once: true });
		return () => {
			window.removeEventListener('pointerdown', resume as any);
		};
	}, [isAudioOn]);

	// Preload critical images so they're ready when shown
	useEffect(() => {
		const urls = [
			'/BackgroundforApp.png',
			'/MainLogo.png',
			'/Queen.png',
			'/HomeButton.png',
			'/Audio.png',
			'/Info.png'
		];
		urls.forEach(src => {
			const img = new Image();
			img.src = src;
		});
	}, []);

	// Play completion sound and update streak when solved in main game
	useEffect(() => {
		if (isSolved && view === 'game') {
			playSound(completeRef);
			setCompletedBoardSize(boardSize); // capture stable completed size
			// Update max streak
			setMaxStreakSize(prev => {
				const safePrev = typeof prev === 'number' ? prev : 0;
				const updated = Math.max(safePrev, boardSize);
				try { localStorage.setItem('qq.maxStreakSize', String(updated)); } catch {}
				return updated;
			});
			// Show overlay for current level; only advance when user continues
			setShowLevelComplete(true);
		}
	}, [isSolved, view, boardSize, changeBoardSize, resetGame]);

	// Calculate current elapsed time per spec
	const currentTime = startTime ? Date.now() - startTime : 0;
	const displayTime = completionTime ?? currentTime;

	const formatTime = (ms: number) => {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
	};

	const handleSquareClick = (row: number, col: number) => {
		// Play click SFX immediately for responsiveness
		playSound(clickRef);
		// Immediate local update for snappy UI
		void toggleQueenAt(row, col);
	};

	const handleStart = () => {
		setView('game');
		// Ensure starting at 6x6 per spec
		if (boardSize !== 6) {
			void changeBoardSize(6);
		}
		// Reset to clean board and timer
		void resetGame();
		setShowCheekyTip(true);
		// Start countdown
		setCountdown(3);
	};

	// Helper function to play sound effects only if audio is enabled
	const playSound = (audioRef: React.RefObject<HTMLAudioElement>) => {
		if (isAudioOn && audioRef.current) {
			audioRef.current.currentTime = 0;
			void audioRef.current.play().catch(() => {});
		}
	};

	const handleAudioToggle = () => {
		setIsAudioOn(prev => {
			const next = !prev;
			const bgm = bgmRef.current;
			if (bgm) {
				if (next) {
					void bgm.play().catch(() => {});
				} else {
					bgm.pause();
				}
			}
			try { localStorage.setItem('qq.audioOn', next ? '1' : '0'); } catch {}
			return next;
		});
	};

	// (Removed level system and next level handler)

	const handleDailyChallengeStart = async () => {
		const todayIST = getISTDateString();
		if (dailyChallenge.lastChallengeDate === todayIST && dailyChallenge.completed) {
			setShowDailyCompleted(true);
			return;
		}

		// Clear any overlays/state from main game to avoid visual carryover
		setShowLevelComplete(false);
		setShowDailyFailure(false);
		setShowDailyCompleted(false);
		setShowInfo(false);

		// Ensure a clean unsolved board BEFORE entering daily view to avoid race with isSolved
		setCompletedBoardSize(null);
		if (boardSize !== 6) {
			await changeBoardSize(6);
		}
		await resetGame();

		// Arm the daily session after reset to avoid incorrectly marking as completed
		setDailyChallenge(prev => ({
			...prev,
			startTime: Date.now(),
			completed: false,
			lastChallengeDate: prev.lastChallengeDate === todayIST ? prev.lastChallengeDate : null,
		}));
		setView('daily');
		setShowCheekyTip(true);
		// Start countdown
		setCountdown(3);
	};

	const handleDailyFailureRetry = () => {
		setShowDailyFailure(false);
		void resetGame();
		setDailyChallenge(prev => ({ ...prev, startTime: Date.now() }));
	};

	const handleDailyFailureHome = () => {
		setShowDailyFailure(false);
		setView('home');
	};

	// Reset confirmation modal state
	const [showResetConfirm, setShowResetConfirm] = useState(false);

	// Countdown effect - properly managed with cleanup
	useEffect(() => {
		if (countdown === null || countdown <= 0) return;
		
		const interval = setInterval(() => {
			setCountdown(prev => {
				if (prev === null || prev <= 1) {
					return null;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(interval);
	}, [countdown]);

	const handleConfirmReset = () => {
		try {
			localStorage.removeItem('qq.maxStreakSize');
			localStorage.removeItem('qq.boardSize');
			localStorage.removeItem('qq.audioOn');
		} catch {}
		setShowResetConfirm(false);
		setMaxStreakSize(null);
		setIsAudioOn(true); // Reset audio to ON
		// Home rule: starting from 6x6 on new run no matter previous level
		void changeBoardSize(6);
		void resetGame();
	};

	// Removed global loading gate to render UI immediately; inline loaders remain

	return (
		<div className="queens-quest-bg h-screen relative overflow-hidden">
			{/* Celebration overlay */}
			<Celebration
				show={showCelebration}
				onHide={hideCelebration}
				completionTime={completionTime}
			/>

			{/* Level Completion Overlay */}
			{showLevelComplete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
					<div className="relative bg-white text-gray-900 rounded-3xl max-w-md w-full p-8 shadow-2xl text-center border-2 border-orange-500">
						<div className="mb-6">
							<h2 className="font-klemer text-3xl font-bold mb-2">{view === 'daily' ? '⚡ DAILY CHALLENGE COMPLETED' : '🎉 Level Complete!'}</h2>
							<p className="font-gulfs text-lg">Congratulations! You solved the {completedBoardSize ?? boardSize}×{completedBoardSize ?? boardSize} puzzle!</p>
							{completionTime !== null && (
								<p className="font-gulfs text-sm mt-2 opacity-90">
									Time: {formatTime(completionTime)}
								</p>
							)}
						</div>
						<div className="flex flex-col gap-3">
							<div className="mb-4">
								<ShareButtons completionTime={completionTime} boardSize={completedBoardSize ?? boardSize} username={username} />
							</div>
							{view === 'daily' ? (
								<button
									onClick={() => {
										setView('home');
										setShowLevelComplete(false);
									}}
									className="font-gulfs px-6 py-3 bg-white border-2 border-orange-500 text-gray-900 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow"
								>
									Back to Home
								</button>
							) : (
								<>
									<button
										onClick={() => {
											setShowLevelComplete(false);
											// advance one size for next round, then reset to start a fresh board
											const next = Math.min((completedBoardSize ?? boardSize) + 1, 12);
											void changeBoardSize(next);
											try { localStorage.setItem('qq.boardSize', String(next)); } catch {}
											setCompletedBoardSize(null);
											void resetGame();
										}}
										className="font-gulfs px-6 py-3 bg-white border-2 border-orange-500 text-gray-900 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow"
									>
										▶ Continue Playing
									</button>
									<button
										onClick={() => {
											setView('home');
											setShowLevelComplete(false);
										}}
										className="font-gulfs px-6 py-3 bg-white border-2 border-orange-500 text-gray-900 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow"
									>
										🏠 Home
									</button>
								</>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Daily Challenge Failure Overlay */}
			{showDailyFailure && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
					<div className="relative bg-white text-gray-900 rounded-3xl max-w-md w-full p-8 shadow-2xl text-center border-2 border-orange-500">
						<div className="mb-6">
							<h2 className="font-klemer text-3xl font-bold mb-2">😔 Game Over!</h2>
							<p className="font-gulfs text-lg">Better luck next time!</p>
							<p className="font-gulfs text-sm mt-2 opacity-90">
								You didn't complete the daily challenge in time.
							</p>
						</div>
						<div className="flex flex-col gap-3">
							<button
								onClick={handleDailyFailureRetry}
								className="font-gulfs px-6 py-3 bg-white border-2 border-orange-500 text-gray-900 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow"
							>
								🔄 Retry
							</button>
							<button
								onClick={handleDailyFailureHome}
								className="font-gulfs px-6 py-3 bg-white border-2 border-orange-500 text-gray-900 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow"
							>
								🏠 Back to Home
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Daily Challenge Already Completed Overlay */}
			{showDailyCompleted && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
					<div className="relative bg-white text-gray-900 rounded-3xl max-w-md w-full p-8 shadow-2xl text-center border-2 border-orange-500">
						<div className="mb-6">
							<h2 className="font-klemer text-3xl font-bold mb-2">🎉 Challenge Completed!</h2>
							<p className="font-gulfs text-lg">You've already completed today's daily challenge!</p>
							<p className="font-gulfs text-sm mt-2 opacity-90">
								Come back tomorrow at 12:00 AM IST for a fresh challenge.
							</p>
						</div>
						<div className="flex flex-col gap-3">
							<button
								onClick={() => setShowDailyCompleted(false)}
								className="font-gulfs px-6 py-3 bg-white border-2 border-orange-500 text-gray-900 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow"
							>
								🏠 Back to Home
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Reset Confirmation Modal */}
			{showResetConfirm && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
					<div className="relative bg-white text-gray-900 rounded-3xl max-w-md w-full p-6 shadow-2xl text-center border-2 border-orange-500">
						<h2 className="font-klemer text-2xl font-bold mb-3">Reset Progress?</h2>
						<p className="font-gulfs text-sm mb-5">This will clear your streak and settings and start from 6×6.</p>
						<div className="flex gap-3 justify-center">
							<button onClick={() => setShowResetConfirm(false)} className="font-gulfs px-5 py-2 bg-white border-2 border-gray-400 text-gray-900 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow">No</button>
							<button onClick={handleConfirmReset} className="font-gulfs px-5 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow">Yes, Reset</button>
						</div>
					</div>
				</div>
			)}

			{/* Info overlay */}
			{showInfo && (
				<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
					<div className="relative bg-white text-black rounded-2xl max-w-md w-full p-5 shadow-2xl border-2 border-orange-500">
						<button
							onClick={() => setShowInfo(false)}
							className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black text-white text-sm"
						>
							✕
						</button>
						<div className="flex items-center gap-3 mb-3">
							<img src="/MainLogo.svg" alt="QueensQuest" className="h-10" />
							<p className="font-gulfs text-lg">
								{view === 'home' ? 'Daily Challenge Info' : 'Game Rules'}
							</p>
						</div>
						{view === 'home' ? (
							<div className="space-y-3">
								<p className="font-gulfs text-sm font-bold text-orange-600">⚡ Daily Challenge Rules:</p>
								<ul className="list-decimal list-inside space-y-2 font-gulfs text-sm">
									<li>Solve the puzzle within 30 seconds!</li>
									<li>Same N-Queens rules apply.</li>
									<li>Unlimited retries if you fail.</li>
									<li>Locks after success until 12:00 AM IST.</li>
								</ul>
							</div>
						) : (
							<ul className="list-decimal list-inside space-y-2 font-gulfs text-sm">
								<li>Click squares to place a Queen.</li>
								<li>No two Queens may share a row, column, or diagonal.</li>
								<li>Place {boardSize} Queens to win.</li>
								<li>Use Check to verify and Reset to start over.</li>
								<li>Click the info button to view these rules anytime.</li>
							</ul>
						)}
					</div>
				</div>
			)}

			{/* Main content */}
			<div className="relative z-10 flex flex-col items-center h-screen p-2 sm:p-4 overflow-y-auto">
				{/* Cheeky challenge banner */}
				{showCheekyTip && (
					<div className="w-full max-w-2xl mb-2">
						<div className="flex items-start gap-2 bg-yellow-100 border border-yellow-300 text-yellow-900 rounded-xl p-3 shadow">
							<span className="mt-0.5">🎲</span>
							<p className="font-gulfs text-sm">
								Queens and boards may shuffle and trick you — a cheeky twist! Are you ready for the challenge?
							</p>
							<button onClick={() => setShowCheekyTip(false)} className="ml-auto text-xs px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded">Dismiss</button>
						</div>
					</div>
				)}
				{view === 'landing' && (
					<div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
						{/* Full-bleed landing background only */}
						<img
							src="/Landing-BackgroundforApp.png"
							alt="Background"
							className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
						/>

						{/* Floating particles - top layer */}
						<div className="absolute inset-0 pointer-events-none z-50">
							{[
								{ e: '♕', animation: 'animate-float-ltr', top: '15%', left: '-10%', delay: '0s', duration: '8s' },
								{ e: '👑', animation: 'animate-float-rtl', top: '25%', left: '110%', delay: '2s', duration: '10s' },
								{ e: '🏆', animation: 'animate-float-ttb', top: '-10%', left: '70%', delay: '4s', duration: '12s' },
								{ e: '♕', animation: 'animate-float-btt', top: '110%', left: '60%', delay: '6s', duration: '9s' },
								{ e: '👑', animation: 'animate-float-diag-tl-br', top: '-10%', left: '-10%', delay: '1s', duration: '11s' },
								{ e: '🏆', animation: 'animate-float-diag-tr-bl', top: '-10%', left: '110%', delay: '3s', duration: '7s' },
								{ e: '♕', animation: 'animate-float-ltr', top: '45%', left: '-10%', delay: '5s', duration: '9s' },
								{ e: '👑', animation: 'animate-float-rtl', top: '75%', left: '110%', delay: '7s', duration: '8s' },
								{ e: '🏆', animation: 'animate-float-ttb', top: '-10%', left: '30%', delay: '1.5s', duration: '10s' },
								{ e: '♕', animation: 'animate-float-btt', top: '110%', left: '85%', delay: '4.5s', duration: '11s' },
							].map((p, i) => (
								<div
									key={i}
									className={`absolute text-2xl sm:text-3xl opacity-60 ${p.animation}`}
									style={{ 
										top: p.top as string, 
										left: p.left as string, 
										animationDelay: p.delay as string,
										animationDuration: p.duration as string
									}}
								>
									{p.e}
								</div>
							))}
						</div>

						{/* Board frame with hover tilt (group) */}
						<div className="group relative rounded-3xl p-3 bg-black/30 border border-white/30 shadow-2xl w-80 h-80 sm:w-96 sm:h-96 md:w-[28rem] md:h-[28rem] transform transition-transform duration-500 ease-out hover:-rotate-2">
							{/* Board background */}
							<div
								className="absolute inset-0 grid gap-0 rounded-2xl overflow-hidden"
								style={{ gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)' }}
							>
								{Array.from({ length: 8 }).map((_, r) => (
									Array.from({ length: 8 }).map((__, c) => {
										const isLight = (r + c) % 2 === 0;
										return (
											<div key={`${r}-${c}`} className={`w-full h-full ${isLight ? 'chess-square-light' : 'chess-square-dark'}`}></div>
										);
									})
								))}
							</div>
							{/* Centered content on the board */}
							<div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-4 text-center">
								<img src="/MainLogo.svg" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/MainLogo.png';}} alt="QueensQuest" className="w-48 sm:w-56 md:w-64 drop-shadow-[0_6px_20px_rgba(0,0,0,0.5)] transform transition-transform duration-500 ease-out group-hover:rotate-1 group-hover:scale-[1.03]" />
								<button
									onClick={() => {
										setView('home');
										playSound(clickRef);
									}}
									className="font-gulfs px-6 py-3 bg-white border-2 border-orange-500 text-gray-900 rounded-2xl font-bold hover:bg-gray-100 transition-all shadow group-hover:shadow-xl group-hover:-translate-y-0.5"
								>
									Enter the Quest
								</button>
							</div>
						</div>
					</div>
				)}
				{view === 'home' && (
					<div className="flex flex-col items-center gap-6 w-full max-w-2xl mt-6">
						{/* Top bar with audio toggle */}
						<div className="flex items-center justify-between w-full mb-2 px-1">
							<button onClick={() => setShowResetConfirm(true)} className="p-2 rounded-lg bg-black/40 border border-white/40 shadow-md">
								<img src="/ResetButton.svg" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/ResetButton.png';}} alt="Reset" className="h-6 w-6" />
							</button>
							<div />
							<button onClick={handleAudioToggle} className="p-2 rounded-lg bg-black/40 border border-white/40 shadow-md">
								<img src="/Audio.svg" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/Audio.png';}} alt="Audio" className="h-6 w-6" />
							</button>
						</div>
						{username && (
							<p className="font-gulfs text-2xl text-visible">Welcome, {username}! 👋</p>
						)}
						
						{/* Action Buttons - moved above rules */}
						<div className="flex flex-row gap-3 w-full">
							<div className="flex-1 flex flex-col items-center">
								<button 
									onClick={handleStart} 
									className="w-full font-gulfs px-4 py-3 bg-white text-gray-900 rounded-2xl text-base font-bold shadow border-2 border-orange-500 hover:bg-gray-100 transition-colors text-center"
								>
									Start Game
								</button>
							</div>
							<div className="flex-1 relative">
								<button 
									onClick={handleDailyChallengeStart} 
									className="w-full font-gulfs px-4 py-3 bg-white text-gray-900 rounded-2xl text-base font-bold shadow border-2 border-orange-500 hover:bg-gray-100 transition-colors text-center"
								>
									Daily Challenge
								</button>
								<button
									onClick={() => setShowInfo(true)}
									className="absolute -top-2 -right-2 p-1.5 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition-colors"
								>
									<img src="/Info.svg" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/Info.png';}} alt="Info" className="h-3 w-3 invert" />
								</button>
							</div>
						</div>

						{/* Max Streak Card and Share */}
						<div className="w-full bg-white text-gray-900 rounded-2xl px-4 py-4 border-2 border-orange-500 shadow-2xl -mt-1">
							<div className="flex items-center justify-between">
								<p className="font-klemer text-lg font-bold">🔥 Max Streak</p>
								<p className="font-gulfs text-base">{maxStreakSize ? `${maxStreakSize}×${maxStreakSize}` : 'NONE'}</p>
							</div>
							<div className="mt-3">
								<ShareButtons completionTime={null} boardSize={maxStreakSize ?? 6} username={username} customText={maxStreakSize ? `I am playing QueensQuest! My max streak is ${maxStreakSize}×${maxStreakSize}! Can you beat it? 🏆 #QueensQuest` : 'I am playing QueensQuest! Join me in this amazing puzzle game! 🏆 #QueensQuest'} />
							</div>
						</div>

						{/* Instructions Card */}
						<div className="w-full bg-white text-gray-900 rounded-2xl px-4 py-4 border-2 border-orange-500 shadow-2xl">
							<div className="flex items-center gap-3 mb-4">
								<span className="text-3xl">🎯</span>
								<p className="font-klemer text-xl font-bold text-gray-900">How to Play (N-Queens)</p>
							</div>
							<div className="space-y-3">
								<div className="flex items-start gap-3">
									<span className="font-gulfs text-gray-900 text-base font-bold">1.</span>
									<p className="font-gulfs text-gray-700">Click squares to place Queens on the board.</p>
								</div>
								<div className="flex items-start gap-3">
									<span className="font-gulfs text-gray-900 text-base font-bold">2.</span>
									<p className="font-gulfs text-gray-700">No two Queens can attack each other (same row, column, or diagonal).</p>
								</div>
								<div className="flex items-start gap-3">
									<span className="font-gulfs text-gray-900 text-base font-bold">3.</span>
									<p className="font-gulfs text-gray-700">Place all Queens safely to complete the level!</p>
								</div>
							</div>
						</div>

						{/* Daily Challenge Status - now handled by overlay */}
					</div>
				)}

				{view === 'game' && (
					<>
						{/* Countdown overlay */}
						{countdown !== null && (
							<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
								<div className="text-center">
									<div className="text-8xl font-klemer text-white mb-4">{countdown}</div>
									<p className="font-gulfs text-2xl text-white">Get Ready!</p>
								</div>
							</div>
						)}
						{/* Top bar with Home and controls */}
						<div className="flex items-center justify-between w-full max-w-3xl mb-3 mt-8 px-2">
							<button onClick={() => {
								setView('home');
								setShowLevelComplete(false);
								setShowDailyFailure(false);
								setShowDailyCompleted(false);
							}} className="p-1 rounded-lg bg-black/40 border border-white/40 shadow-md">
								<img src="/HomeButton.png" alt="Home" className="h-8 w-8" />
							</button>
							<div className="flex items-center gap-2">
								<button onClick={handleAudioToggle} className="p-2 rounded-lg bg-black/40 border border-white/40 shadow-md">
									<img src="/Audio.png" alt="Audio" className="h-6 w-6" />
								</button>
								<button onClick={() => setShowInfo(true)} className="p-2 rounded-lg bg-black/40 border border-white/40 shadow-md">
									<img src="/Info.png" alt="Info" className="h-6 w-6" />
								</button>
							</div>
						</div>

						{/* Level indicator */}
						<div className="text-center mb-6 mt-4">
							<div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-xl border-2 border-orange-500 shadow">
								<span className="font-klemer text-lg font-bold">🏆 Level {boardSize - 5}</span>
								<span className="font-gulfs text-sm text-gray-700">({boardSize}×{boardSize})</span>
							</div>
						</div>

						{/* Chess Board only */}
						<div className="flex justify-center mb-6 w-full">
							{loading ? (
								<div className="flex items-center justify-center w-60 h-60 bg-white/20 backdrop-blur-md rounded-3xl border-2 border-white/30">
									<div className="text-center">
										<div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mx-auto mb-4"></div>
										<p className="font-gulfs text-visible text-lg">Loading...</p>
									</div>
								</div>
							) : (
								<div
									className="chess-board grid gap-0 p-2 sm:p-3 rounded-2xl max-w-full overflow-hidden"
									style={{
										gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
										gridTemplateRows: `repeat(${boardSize}, 1fr)`,
									}}
								>
									{board.map((row, rowIndex) =>
										row.map((hasQueen, colIndex) => {
											const isConflict = validation.conflicts.some(
												conflict => conflict.row === rowIndex && conflict.col === colIndex
											);
											const isLight = (rowIndex + colIndex) % 2 === 0;

											return (
												<button
													key={`${rowIndex}-${colIndex}`}
													onPointerDown={() => handleSquareClick(rowIndex, colIndex)}
													disabled={loading}
													className={`
														chess-square w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center
														transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed
														${isLight ? 'chess-square-light' : 'chess-square-dark'}
														${isConflict ? 'ring-2 ring-red-500 bg-red-300/50 conflict-pulse' : ''}
														${isSolved ? 'ring-2 ring-green-500 bg-green-300/50 win-celebration' : ''}
													`}
												>
													{hasQueen && (
														<img
															src="/Queen.png"
															alt="Queen"
															className="queen-icon w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 object-contain drop-shadow-lg"
														/>
													)}
												</button>
											);
										})
									)}
								</div>
							)}
						</div>

						{/* Status and controls under grid */}
						{/* Status display - no controls for pure challenge */}
						<div className="text-center mb-6 bg-white/90 backdrop-blur-md rounded-xl px-4 py-3 w-full max-w-md border-2 border-orange-500 shadow-2xl">
							<p className={`font-klemer text-lg font-bold text-gray-900 ${isSolved ? 'text-green-600' : validation.conflicts.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
								{validation.message}
							</p>
							<p className="font-gulfs text-gray-700 text-sm mt-1">Queens: {queenCount}/{boardSize}</p>
							<p className="font-gulfs text-gray-700 text-sm mt-1">⏱️ Time: {formatTime(displayTime)}</p>
							{isSolved && (
								<div className="mt-3">
									<ShareButtons completionTime={completionTime} boardSize={boardSize} username={username} />
								</div>
							)}
						</div>
					</>
				)}

				{view === 'daily' && (
					<>
						{/* Countdown overlay */}
						{countdown !== null && (
							<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
								<div className="text-center">
									<div className="text-8xl font-klemer text-white mb-4">{countdown}</div>
									<p className="font-gulfs text-2xl text-white">Get Ready!</p>
								</div>
							</div>
						)}
						{/* Top bar with Home and audio toggle */}
						<div className="flex items-center justify-between w-full max-w-3xl mb-3 mt-8 px-2">
							<button onClick={() => {
								setView('home');
								setShowLevelComplete(false);
								setShowDailyFailure(false);
								setShowDailyCompleted(false);
							}} className="p-1 rounded-lg bg-black/40 border border-white/40 shadow-md">
								<img src="/HomeButton.png" alt="Home" className="h-8 w-8" />
							</button>
							<div className="flex items-center gap-2">
								<button onClick={handleAudioToggle} className="p-2 rounded-lg bg-black/40 border border-white/40 shadow-md">
									<img src="/Audio.png" alt="Audio" className="h-6 w-6" />
								</button>
								<button onClick={() => setShowInfo(true)} className="p-2 rounded-lg bg-black/40 border border-white/40 shadow-md">
									<img src="/Info.png" alt="Info" className="h-6 w-6" />
								</button>
							</div>
						</div>

						{/* Daily Challenge Timer */}
						<div className="text-center mb-6 mt-4">
							<div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-xl border-2 border-orange-500 shadow">
								<span className="font-klemer text-lg font-bold">⚡ Daily Challenge</span>
								<span className="font-gulfs text-sm text-gray-700">({boardSize}×{boardSize})</span>
							</div>
						</div>

						{/* Timer Display */}
						{dailyChallenge.startTime && (
							<div className="text-center mb-3">
								<div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border shadow ${
									dailyChallenge.timeLimit - Math.floor((Date.now() - dailyChallenge.startTime) / 1000) <= 10
										? 'bg-red-100 border-red-300 text-red-700'
										: 'bg-orange-100 border-orange-300 text-orange-700'
								}`}>
									<span className="font-klemer text-lg font-bold">
										⏱️ {Math.max(0, dailyChallenge.timeLimit - Math.floor((Date.now() - dailyChallenge.startTime) / 1000))}s
									</span>
								</div>
							</div>
						)}

						{/* Chess Board */}
						<div className="flex justify-center mb-6 w-full">
							{loading ? (
								<div className="flex items-center justify-center w-60 h-60 bg-white/20 backdrop-blur-md rounded-3xl border-2 border-white/30">
									<div className="text-center">
										<div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mx-auto mb-4"></div>
										<p className="font-gulfs text-visible text-lg">Loading...</p>
									</div>
								</div>
							) : (
								<div
									className="chess-board grid gap-0 p-2 sm:p-3 rounded-2xl max-w-full overflow-hidden"
									style={{
										gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
										gridTemplateRows: `repeat(${boardSize}, 1fr)`,
									}}
								>
									{board.map((row, rowIndex) =>
										row.map((hasQueen, colIndex) => {
											const isConflict = validation.conflicts.some(
												conflict => conflict.row === rowIndex && conflict.col === colIndex
											);
											const isLight = (rowIndex + colIndex) % 2 === 0;

											return (
												<button
													key={`${rowIndex}-${colIndex}`}
													onPointerDown={() => handleSquareClick(rowIndex, colIndex)}
													disabled={loading}
													className={`
														chess-square w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center
														transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed
														${isLight ? 'chess-square-light' : 'chess-square-dark'}
														${isConflict ? 'ring-2 ring-red-500 bg-red-300/50 conflict-pulse' : ''}
														${isSolved ? 'ring-2 ring-green-500 bg-green-300/50 win-celebration' : ''}
													`}
												>
													{hasQueen && (
														<img
															src="/Queen.png"
															alt="Queen"
															className="queen-icon w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 object-contain drop-shadow-lg"
														/>
													)}
												</button>
											);
										})
									)}
								</div>
							)}
						</div>

						{/* Status and controls */}
						<div className="text-center mb-6 bg-white/90 backdrop-blur-md rounded-xl px-4 py-3 w-full max-w-md border-2 border-orange-500 shadow-2xl">
							<p className={`font-klemer text-lg font-bold text-gray-900 ${isSolved ? 'text-green-600' : validation.conflicts.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
								{validation.message}
							</p>
							<p className="font-gulfs text-gray-700 text-sm mt-1">Queens: {queenCount}/{boardSize}</p>
							{/* Pure challenge: no controls */}
						</div>
					</>
				)}
			</div>
		</div>
	);
};
