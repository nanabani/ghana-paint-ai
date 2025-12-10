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
  messages = [
    "Loading your content...",
    "Almost there...",
    "Preparing everything...",
    "Just a moment...",
    "Getting things ready..."
  ],
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
    <div className={`flex flex-col items-center justify-center gap-4 sm:gap-6 p-4 sm:p-8 ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear"
        }}
      >
        <Loader2 className="w-8 h-8 sm:w-12 sm:h-12 text-accent" />
      </motion.div>

      <div className="relative h-12 sm:h-16 flex items-center justify-center w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={displayMessages.length === 1 ? `${messageKey}-${displayMessages[0]}` : currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="relative">
              <motion.h2
                className="text-sm sm:text-base md:text-lg font-semibold text-center text-ink px-3 sm:px-4 max-w-[280px] sm:max-w-none"
                animate={{
                  textShadow: [
                    "0 0 0px rgba(194, 65, 12, 0)",
                    "0 0 20px rgba(194, 65, 12, 0.3)",
                    "0 0 0px rgba(194, 65, 12, 0)"
                  ]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {displayMessages[currentIndex].split("").map((char, i) => (
                  <motion.span
                    key={i}
                    className="inline-block"
                    initial={{ opacity: 0.5 }}
                    animate={{
                      opacity: [0.5, 1, 0.5],
                      textShadow: [
                        "0 0 0px rgba(194, 65, 12, 0)",
                        "0 0 8px rgba(194, 65, 12, 0.4)",
                        "0 0 0px rgba(194, 65, 12, 0)"
                      ]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      repeatType: "loop",
                      delay: i * 0.05,
                      ease: "easeInOut"
                    }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </motion.span>
                ))}
              </motion.h2>

              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/20 to-transparent blur-xl"
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
        <div className="flex gap-2 mt-2 sm:mt-4">
          {displayMessages.map((_, index) => (
            <motion.div
              key={index}
              className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full"
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

