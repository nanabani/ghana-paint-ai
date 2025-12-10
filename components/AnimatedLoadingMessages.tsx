import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface AnimatedLoadingMessagesProps {
  messages?: string[];
  interval?: number;
  className?: string;
  showDots?: boolean;
}

const AnimatedLoadingMessages: React.FC<AnimatedLoadingMessagesProps> = ({
  messages = [],
  interval = 3000,
  className = "",
  showDots = true
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayMessages, setDisplayMessages] = useState(messages);
  const [messageKey, setMessageKey] = useState(0);

  // Update messages when prop changes - use key to force re-animation
  useEffect(() => {
    if (messages && messages.length > 0) {
      setDisplayMessages(messages);
      // Force re-animation by changing key when messages change
      setMessageKey(prev => prev + 1);
      if (messages.length > 1) {
        setCurrentIndex(0);
      }
    }
  }, [messages]);

  useEffect(() => {
    if (displayMessages.length === 0) return;
    
    // If only one message, don't rotate (it will animate when message changes via key)
    if (displayMessages.length === 1) {
      return;
    }
    
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayMessages.length);
    }, interval);

    return () => clearInterval(timer);
  }, [displayMessages.length, interval]);

  if (displayMessages.length === 0) return null;

  return (
    <div className={`flex flex-col items-center justify-center gap-3 sm:gap-4 p-3 sm:p-4 ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear"
        }}
      >
        <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-accent" />
      </motion.div>

      <div className="relative h-10 sm:h-12 flex items-center justify-center w-full max-w-xs sm:max-w-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={displayMessages.length === 1 ? `${messageKey}-${displayMessages[0]}` : currentIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center justify-center px-3"
          >
            <div className="relative w-full">
              <motion.p
                className="text-xs sm:text-sm font-semibold text-center text-ink whitespace-nowrap overflow-hidden text-ellipsis"
                animate={{
                  textShadow: [
                    "0 0 0px rgba(194, 65, 12, 0)",
                    "0 0 12px rgba(194, 65, 12, 0.25)",
                    "0 0 0px rgba(194, 65, 12, 0)"
                  ]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {displayMessages[currentIndex]}
              </motion.p>

              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/15 to-transparent blur-lg"
                animate={{
                  x: ["-100%", "100%"]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {showDots && displayMessages.length > 1 && (
        <div className="flex gap-1.5 mt-1 sm:mt-2">
          {displayMessages.map((_, index) => (
            <motion.div
              key={index}
              className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full"
              animate={{
                scale: currentIndex === index ? 1.5 : 1,
                backgroundColor: currentIndex === index 
                  ? "var(--color-accent)" 
                  : "var(--color-ink-subtle)"
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AnimatedLoadingMessages;

