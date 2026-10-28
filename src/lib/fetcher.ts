class FetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new FetchError(`Request to ${url} failed`, res.status);
  }
  return res.json() as Promise<T>;
}
