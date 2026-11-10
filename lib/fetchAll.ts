// Supabase returns at most 1,000 rows per request and silently stops there,
// so any "give me everything" query has to read in pages. Stable ordering
// (a unique column last) is required in the page callback.
export async function fetchAllRows<T = Record<string, unknown>>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>
): Promise<T[]> {
  const size = 1000;
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data } = await page(from, from + size - 1);
    const rows = (data || []) as T[];
    if (rows.length === 0) break;
    all.push(...rows);
    from += rows.length;
  }
  return all;
}
