/** Loading state for CRM pages: quiet placeholders, no spinner choreography (design system §8). */
export default function CrmLoading() {
  return (
    <div role="status" aria-live="polite" className="py-2">
      <span className="sr-only">Se încarcă…</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="h-8 w-64 rounded-bloc bg-adancit" />
        <div className="h-4 w-96 max-w-full rounded-bloc bg-adancit" />
        <div className="mt-4 h-40 w-full rounded-panou bg-adancit" />
      </div>
    </div>
  );
}
