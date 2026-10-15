function pause(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function canRetryPayment(error) {
  return error?.data?.code === "PAYMENT_PENDING" || !error?.status || error.status >= 500 || error.status === 429;
}

export async function confirmPayment(reference, {
  verify,
  signal,
  onRetry = () => {},
  delays = [1500, 2500, 4000, 6000, 8000],
  wait = pause,
}) {
  for (let attempt = 0; ; attempt += 1) {
    signal?.throwIfAborted();
    try {
      const response = await verify(reference, { signal });
      if (response.success !== true || !response.data?.id || response.data.payment_status !== "paid") {
        throw Object.assign(new Error("Your payment is still being confirmed."), {
          status: 409,
          data: { code: "PAYMENT_PENDING" },
        });
      }
      return response.data;
    } catch (error) {
      signal?.throwIfAborted();
      if (attempt >= delays.length || !canRetryPayment(error)) throw error;
      onRetry();
      await wait(delays[attempt], signal);
    }
  }
}
