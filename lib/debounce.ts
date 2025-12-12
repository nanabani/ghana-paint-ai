/**
 * Debounce utility function
 * Delays function execution until after a specified wait time has passed
 * since the last time it was invoked
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Debounce with immediate execution option
 * Executes immediately on first call, then debounces subsequent calls
 */
export function debounceImmediate<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isFirstCall = true;

  return function debounced(...args: Parameters<T>) {
    if (isFirstCall) {
      isFirstCall = false;
      func(...args);
      return;
    }

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
      isFirstCall = true;
    }, wait);
  };
}


