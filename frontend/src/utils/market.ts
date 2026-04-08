/**
 * Utility to check if the Indian Stock Market (NSE/BSE) is currently open.
 * Market Hours: 9:15 AM - 3:30 PM IST, Monday to Friday.
 */
export const isMarketOpen = (): boolean => {
  // Convert current time to IST
  // Since we are targeting Indian users, we can use local time if they are in India,
  // but to be safe we should ideally use UTC conversion.
  // For now, assuming the user's system time is set to their local time (IST).
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Weekends
  if (day === 0 || day === 6) return false;

  // 9:15 AM = 555 minutes
  // 3:30 PM = 930 minutes
  if (totalMinutes >= 555 && totalMinutes <= 930) {
    return true;
  }

  return false;
};
