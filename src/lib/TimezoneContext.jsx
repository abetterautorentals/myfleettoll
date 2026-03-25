import React, { createContext, useContext, useState } from 'react';
const TimezoneContext = createContext({});
export function TimezoneProvider({ children }) {
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles'
  );
  const updateTimezone = async (tz) => setTimezone(tz);
  return (
    <TimezoneContext.Provider value={{ timezone, updateTimezone, loading: false }}>
      {children}
    </TimezoneContext.Provider>
  );
}
export function useTimezone() { return useContext(TimezoneContext); }
