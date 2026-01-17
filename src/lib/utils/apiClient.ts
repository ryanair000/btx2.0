const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second, exponential backoff

interface ApiError extends Error {
  status?: number;
  retryable?: boolean;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: any): boolean {
  // Retry on 429 (rate limit), 500-599 (server errors), and network errors
  if (error.status === 429 || error.status >= 500) return true;
  if (error.message === "Failed to fetch" || error.code === "ECONNREFUSED")
    return true;
  return false;
}

export async function fetchWithRetry(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(endpoint, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      // Handle successful responses
      if (response.ok) {
        return response;
      }

      // Check if error is retryable
      const error: ApiError = new Error(
        `API error: ${response.status} ${response.statusText}`
      );
      error.status = response.status;
      error.retryable = isRetryableError(error);

      if (!error.retryable) {
        throw error; // Don't retry non-retryable errors
      }

      // Prepare for retry
      lastError = error;

      if (attempt < MAX_RETRIES - 1) {
        const delayMs = RETRY_DELAY * Math.pow(2, attempt);
        console.warn(
          `API request failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delayMs}ms...`
        );
        await sleep(delayMs);
      }
    } catch (error) {
      const apiError = error as ApiError;
      lastError = apiError;

      if (!isRetryableError(apiError) || attempt === MAX_RETRIES - 1) {
        throw error;
      }

      if (attempt < MAX_RETRIES - 1) {
        const delayMs = RETRY_DELAY * Math.pow(2, attempt);
        console.warn(
          `Request failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delayMs}ms...`
        );
        await sleep(delayMs);
      }
    }
  }

  // If we get here, all retries failed
  throw (
    lastError ||
    new Error("Failed after multiple retry attempts")
  );
}

export async function fetchJSON<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchWithRetry(endpoint, options);
  return response.json() as Promise<T>;
}
