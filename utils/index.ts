export function splitArrayIntoBatches<T>(arr: T[], batchSize: number): T[][] {
  if (batchSize <= 0) {
    return [];
  }

  const batches = [] as any[];
  for (let i = 0; i < arr.length; i += batchSize) {
    batches.push(arr.slice(i, i + batchSize));
  }

  return batches;
}
