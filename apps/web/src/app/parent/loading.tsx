export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-64 animate-pulse rounded-xl bg-line/60" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-3xl bg-line/50" />
        <div className="h-48 animate-pulse rounded-3xl bg-line/50" />
      </div>
    </div>
  );
}
