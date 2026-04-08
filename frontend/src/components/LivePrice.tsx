import React, { useState, useEffect, useRef, useMemo } from 'react';

interface LivePriceProps {
  price: number;
  previousPrice?: number | null;
  currency?: string;
  locale?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCurrency?: boolean;
}

/**
 * TradingView-style live price display.
 * Only the digits that change between price updates get highlighted
 * with a green (up) or red (down) flash animation.
 */
const LivePrice: React.FC<LivePriceProps> = ({
  price,
  previousPrice,
  currency = 'INR',
  locale = 'en-IN',
  size = 'lg',
  showCurrency = false,
}) => {
  const [displayedPrice, setDisplayedPrice] = useState(price);
  const [prevDisplayed, setPrevDisplayed] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0); // Force re-render for animation
  const prevPriceRef = useRef<number>(price);

  useEffect(() => {
    if (price !== prevPriceRef.current) {
      setPrevDisplayed(prevPriceRef.current);
      setDisplayedPrice(price);
      setFlashKey((k) => k + 1);
      prevPriceRef.current = price;
    }
  }, [price]);

  const direction: 'up' | 'down' | 'none' = useMemo(() => {
    const prev = previousPrice ?? prevDisplayed;
    if (prev === null || prev === undefined) return 'none';
    if (price > prev) return 'up';
    if (price < prev) return 'down';
    return 'none';
  }, [price, previousPrice, prevDisplayed]);

  // Format price to string with locale
  const formatPrice = (p: number): string => {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(p);
  };

  const currentStr = formatPrice(displayedPrice);
  const previousStr = prevDisplayed !== null ? formatPrice(prevDisplayed) : currentStr;

  // Pad strings to same length (right-align digits)
  const maxLen = Math.max(currentStr.length, previousStr.length);
  const currPadded = currentStr.padStart(maxLen, ' ');
  const prevPadded = previousStr.padStart(maxLen, ' ');

  const sizeClasses: Record<string, string> = {
    sm: 'lp-sm',
    md: 'lp-md',
    lg: 'lp-lg',
    xl: 'lp-xl',
  };

  return (
    <span className={`live-price-container ${sizeClasses[size]}`} key={`lp-${flashKey}`}>
      <span className="lp-symbol">₹</span>
      {currPadded.split('').map((char, i) => {
        const changed = prevPadded[i] !== char && prevDisplayed !== null;
        const isDigit = /\d/.test(char);
        const isSeparator = char === ',' || char === '.';

        return (
          <span
            key={`${i}-${flashKey}`}
            className={[
              'lp-char',
              isDigit ? 'lp-digit' : '',
              isSeparator ? 'lp-separator' : '',
              changed && isDigit ? `lp-flash lp-flash-${direction}` : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {char}
          </span>
        );
      })}
      {showCurrency && <span className="lp-currency">{currency}</span>}
    </span>
  );
};

export default LivePrice;
