/**
 * Seconds left until `endsAt`, always derived from the wall clock.
 *
 * The rest timer used to be a recursive `setTimeout` that subtracted 1 from a
 * counter every 1000 ms. Browsers throttle timers in a backgrounded tab and
 * freeze them on a locked phone, so after a couple of minutes away the number
 * on screen was minutes behind reality — it lied exactly when the user came
 * back mid-workout to check it. Anchoring on an absolute end instant and
 * recomputing from `Date.now()` makes a late, coalesced or skipped tick cost
 * nothing: the value is whatever the clock says, not whatever the ticks added
 * up to.
 *
 * Rounds up so a timer started at 90 s reads "90s" on the first paint instead
 * of blinking straight to 89, and clamps at 0 so an overdue timer never shows
 * a negative countdown.
 */
export function remainingSeconds(endsAt: number, now: number = Date.now()): number {
  if (!Number.isFinite(endsAt)) return 0;
  const ms = endsAt - now;
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}
