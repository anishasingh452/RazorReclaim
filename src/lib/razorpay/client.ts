import Razorpay from "razorpay";

let cached: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (cached) return cached;

  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error("Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET");

  // Hard safety guard: this project must never run against live Razorpay
  // credentials — refuse to construct a client with anything but a Test
  // Mode key, regardless of what's in the environment.
  if (!key_id.startsWith("rzp_test_")) {
    throw new Error(`RAZORPAY_KEY_ID must be a Test Mode key (rzp_test_...), got: ${key_id}`);
  }

  cached = new Razorpay({ key_id, key_secret });
  return cached;
}
