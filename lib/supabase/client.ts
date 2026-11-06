import { createBrowserClient } from "@supabase/ssr";

const AUTH_TIMEOUT_MS = 15_000;

// Bound authentication requests without interrupting database writes or uploads.
const fetchWithAuthTimeout: typeof fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  if (!new URL(url).pathname.startsWith("/auth/v1/")) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const signal = init?.signal ?? (input instanceof Request ? input.signal : null);
  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener("abort", forwardAbort, { once: true });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AUTH_TIMEOUT_MS);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    // Keep the deadline active until the small auth response body has arrived.
    await response.clone().arrayBuffer();
    return response;
  } catch (error) {
    if (timedOut) throw new Error("AUTH_REQUEST_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
};

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "class_scheduler" },
      global: { fetch: fetchWithAuthTimeout },
    },
  );
}
