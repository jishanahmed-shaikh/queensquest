interface ShareButtonsProps {
  completionTime: number | null;
  boardSize: number;
  username: string | null;
  customText?: string;
}

export const ShareButtons = ({ completionTime, boardSize, username: _username, customText }: ShareButtonsProps) => {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const baseText = completionTime 
    ? `I just completed the ${boardSize}x${boardSize} Queens Quest puzzle in ${formatTime(completionTime)}! Can you beat my time? 🏆 #QueensQuest #PuzzleChallenge`
    : `I just completed the ${boardSize}x${boardSize} Queens Quest puzzle! in Can you beat me? 🏆 #QueensQuest #PuzzleChallenge`;
  const shareText = customText ?? baseText;

  const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(window.location.href)}&title=${encodeURIComponent(shareText)}`;
  const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(window.location.href)}`;

  return (
    <div className="flex gap-3 justify-center">
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-black hover:bg-gray-900 text-white rounded-lg font-bold transition-colors shadow-lg"
      >
        Share on X
      </a>
      <a
        href={redditUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold transition-colors shadow-lg"
      >
        Share on Reddit
      </a>
    </div>
  );
};
