import React, { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const TimezoneContext = createContext();

export const TimezoneProvider = ({ children }) => {
  const [timezone, setTimezone] = useState(() => {
    // Default: auto-detect from browser
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  });
  const [userTimezone, setUserTimezone] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user's timezone preference on mount
  useEffect(() => {
    const loadUserTimezone = async () => {
      try {
        const user = await base44.auth.me();
        if (user?.timezone) {
          setUserTimezone(user.timezone);
          setTimezone(user.timezone);
        }
      } catch (err) {
        // User not authenticated or error - use browser detection
        console.log('[TimezoneProvider] Using browser timezone:', timezone);
      } finally {
        setLoading(false);
      }
    };

    loadUserTimezone();
  }, []);

  const updateTimezone = async (newTimezone) => {
    try {
      await base44.auth.updateMe({ timezone: newTimezone });
      setTimezone(newTimezone);
      setUserTimezone(newTimezone);
      return true;
    } catch (err) {
      console.error('[TimezoneProvider] Error updating timezone:', err);
      return false;
    }
  };

  return (
    <TimezoneContext.Provider value={{ timezone, userTimezone, loading, updateTimezone }}>
      {children}
    </TimezoneContext.Provider>
  );
};

export const useTimezone = () => {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within TimezoneProvider');
  }
  return context;
};