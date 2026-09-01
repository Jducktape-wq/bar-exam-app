/* ============================================================
   App configuration.
   Currently points at the throwaway P1 test project (db/README.md).
   Repointing at the real project later = change these two lines.
   The publishable key is public by design; RLS is the security
   boundary (db/schema.sql).
   ============================================================ */
window.APP_CONFIG = {
  SUPABASE_URL: "https://gfozpfayjnpjvilevovm.supabase.co",
  SUPABASE_KEY: "sb_publishable_ckxvh4xM11AGQzbSO1olCw_HYq7cr39",
  // Manager access is real Supabase Auth (email + password); the
  // client-side password from the baseline (REVIEW.md 1.3) is gone.

  // Must match the interval in db/migrations/003_trial_gating.sql.
  TRIAL_DAYS: 14,
  // Stripe Payment Link for subscribing. Empty until the Stripe account
  // exists; the subscribe button falls back to a contact email.
  PAYMENT_LINK: "",
  CONTACT_EMAIL: "jducktape@yahoo.com"
};
