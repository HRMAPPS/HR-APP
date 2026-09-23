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

// Current hour in Jakarta time (0-23), independent of the device's local
// timezone/clock settings — used to pick "Selamat pagi/siang/sore/malam".
export function jakartaHour() {
  return Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }))
}

// Indonesian time-of-day greeting, matching the reference app's copy.
export function greetingID() {
  const h = jakartaHour()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 19) return 'Selamat sore'
  return 'Selamat malam'
}
