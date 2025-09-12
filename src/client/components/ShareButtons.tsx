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
    ? `I completed a ${boardSize}×${boardSize} QueensQuest puzzle in ${formatTime(completionTime)}! Can you beat my time? 🏆 #QueensQuest`
    : `I completed a ${boardSize}×${boardSize} QueensQuest puzzle! Try to beat my board! 🏆 #QueensQuest`;
  const shareText = customText ?? baseText;

  // Use a simple game URL instead of the current page URL
  const gameUrl = 'https://queensquest.game';
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(gameUrl)}&title=${encodeURIComponent(shareText)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(gameUrl)}`;

  return (
    <div className="flex gap-3 justify-center">
      <a 
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-black hover:bg-gray-900 text-white rounded-lg font-bold transition-colors shadow-lg cursor-pointer inline-block text-center no-underline"
        style={{ textDecoration: 'none' }}
      >
        Share on X
      </a>
      <a 
        href={redditUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold transition-colors shadow-lg cursor-pointer inline-block text-center no-underline"
        style={{ textDecoration: 'none' }}
      >
        Share on Reddit
      </a>
    </div>
  );
};
