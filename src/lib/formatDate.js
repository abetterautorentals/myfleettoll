export function formatDateInTimezone(date, timezone = 'America/Los_Angeles', formatStr = null) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('en-US', { 
      timeZone: timezone,
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  } catch {
    return String(date);
  }
}
