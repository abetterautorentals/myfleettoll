/**
 * Format a date/datetime string in the user's local timezone
 * @param {string|Date} dateString - ISO string or Date object (usually UTC from database)
 * @param {string} timezone - User's IANA timezone (e.g., 'America/Los_Angeles')
 * @param {string} format - 'date' | 'time' | 'datetime' | 'datetime-short'
 * @returns {string} - Formatted date/time in user's timezone
 */
export const formatDateInTimezone = (dateString, timezone, format = 'datetime') => {
  if (!dateString) return '';

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: format.includes('time') ? '2-digit' : undefined,
    minute: format.includes('time') ? '2-digit' : undefined,
    second: format === 'datetime' ? '2-digit' : undefined,
    hour12: true,
  });

  const parts = formatter.formatToParts(date);
  const values = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  if (format === 'date') {
    return `${values.month}/${values.day}/${values.year}`;
  } else if (format === 'time') {
    return `${values.hour}:${values.minute} ${values.dayPeriod || ''}`.trim();
  } else if (format === 'datetime-short') {
    return `${values.month}/${values.day}/${values.year} ${values.hour}:${values.minute} ${values.dayPeriod || ''}`.trim();
  } else {
    // 'datetime'
    return `${values.month}/${values.day}/${values.year} ${values.hour}:${values.minute}:${values.second} ${values.dayPeriod || ''}`.trim();
  }
};

/**
 * Format datetime for display in tooltips/detailed views
 */
export const formatFullDate = (dateString, timezone) => {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return formatter.format(date);
};