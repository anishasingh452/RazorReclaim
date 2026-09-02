import { config } from "dotenv";
config({ path: ".env.local" });

import { Resend } from "resend";

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const demoBase = process.env.DEMO_EMAIL_BASE;
  if (!apiKey || !from || !demoBase) throw new Error("Missing RESEND_API_KEY / RESEND_FROM_EMAIL / DEMO_EMAIL_BASE");

  const to = demoBase;

  const resend = new Resend(apiKey);

  console.log(`Sending test email from ${from} to ${to}...`);
  const result = await resend.emails.send({
    from,
    to,
    subject: "RazorReclaim connectivity test",
    html: "<p>This confirms Resend is wired up correctly for RazorReclaim recovery emails.</p>",
  });

  if (result.error) {
    console.error("FAILED:", result.error);
    process.exit(1);
  }
  console.log("Sent. Resend message id:", result.data?.id);
  console.log("Resend connectivity: OK");
}

main().catch((err) => {
  console.error("test-resend failed:", err);
  process.exit(1);
});
