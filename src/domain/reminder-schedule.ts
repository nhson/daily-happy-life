/** QStash cron expression for a daily reminder at `time` ("HH:MM") in `timeZone`. See ADR 0001. */
export function reminderCron(time: string, timeZone: string): string {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) throw new Error(`Invalid reminder time: ${time}`);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new Error(`Unknown time zone: ${timeZone}`);
  }
  return `CRON_TZ=${timeZone} ${Number(m[2])} ${Number(m[1])} * * *`;
}
