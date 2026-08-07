// new Date().toISOString() is always UTC. Since WIB is UTC+7, using it to
// compute "today" or a month's start/end date shifts the result by a day
// during Jakarta's morning hours (or even the whole evening, near month
// boundaries). Every "what's today's date" computation in this app should
// go through these helpers instead.

export function toDateStr(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) // en-CA => YYYY-MM-DD
}

export function todayStr() {
  return toDateStr(new Date())
}
