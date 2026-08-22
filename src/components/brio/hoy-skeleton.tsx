/** Decorative stand-in for the Hoy screen while the store hydrates. */
export function HoySkeleton() {
  return (
    <div className="min-h-dvh bg-background" aria-busy="true">
      <div className="mx-auto max-w-md px-4 pb-6 pt-[max(0.5rem,env(safe-area-inset-top))]" aria-hidden>
        {/* Title — h1 text-3xl + subtitle text-sm, mb-4 */}
        <header className="mb-4">
          <div className="h-9 w-52 rounded-md bg-muted" />
          <div className="mt-1 h-5 w-40 rounded-md bg-muted/70" />
        </header>

        {/* DateNav — keeps the rings card from jumping */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="size-11 rounded-xl bg-muted" />
          <div className="flex flex-col items-center gap-1">
            <div className="h-5 w-24 rounded-md bg-muted" />
            <div className="h-3 w-36 rounded-md bg-muted/70" />
          </div>
          <div className="size-11 rounded-xl bg-muted" />
        </div>

        {/* Rings card — 148px grey tracks + legend, same Card padding */}
        <div className="mb-4 rounded-3xl bg-card p-4 shadow-card">
          <div className="flex items-center gap-4">
            <svg width={148} height={148} viewBox="0 0 140 140" className="shrink-0">
              <circle cx="70" cy="70" r="58" fill="none" stroke="var(--brio-muted)" strokeWidth="9" />
              <circle cx="70" cy="70" r="46" fill="none" stroke="var(--brio-muted)" strokeWidth="9" />
              <circle cx="70" cy="70" r="34" fill="none" stroke="var(--brio-muted)" strokeWidth="9" />
            </svg>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="h-4 w-full rounded-md bg-muted" />
              <div className="h-4 w-5/6 rounded-md bg-muted" />
              <div className="h-4 w-4/6 rounded-md bg-muted" />
            </div>
          </div>
        </div>

        {/* Registro rápido — h-20 rounded-2xl tiles */}
        <div className="mb-2 mt-6 h-3 w-28 rounded-md bg-muted" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
