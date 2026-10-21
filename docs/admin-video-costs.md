# Admin video costs — 21 October 2026

P-Video 2 transport is fixed to API resolution `720p`, `draft:true`, 24 fps,
with audio. Published source: https://docs.api.pruna.ai/guides/models/p-video-2.
The rate is USD0.015 per returned video second. Requested output base estimates:
5s USD0.075, 10s USD0.15, 60s USD0.90.

60s uses three 20s calls and one assembled MP4. It is not a native 60s request.
The quote reserves one extra second per call: 60s reserves USD0.945 before FX,
tax, and processing. Native output observed in the accepted test was 1280x704.
Visual/voice continuity across a longer chain is not certified by arithmetic.

Admin identity is server-side `VIDEO_ADMIN_EMAIL`, falling back to the existing
verified `VIDEO_TEST_EMAIL` owner. Admin processor requests have zero purchased
credit charge even when customer debit is enabled. Browser-supplied role headers
are never forwarded. The private processor binds the role to the stored quote.

The processor enforces an admin monthly EUR10 reservation ceiling (Helsinki month),
which `ADMIN_AI_MAX_MONTH_EUR` can lower but cannot raise. Legacy approved jobs
count as admin. Failed/uncertain jobs retain their reservation. All processor
models share it, across restarts through existing durable metadata. Global daily,
monthly, lifetime, durable-storage and explicit approval gates remain in force.
This is an application reservation limit, not a guarantee on a vendor invoice.
The separate legacy Veo Worker route is disabled by its expired cost review and
must not be re-enabled without a shared cross-backend budget implementation.

Each completed Pruna task retains measured duration and conservative whole-second
list-price usage, including a segment whose downloaded media later fails quality
checks. Task IDs make usage idempotent. `invoiceVerified:false` remains explicit:
provider billing records must be reconciled before calling this an actual charge.
Missing media, FX, or VAT costs still block generation; none are assumed zero.

Customer packs stay EUR1/30 credits and EUR5/280 credits. Live video pricing must
remain 100 credits per EUR of fully quoted service cost. Payment fee and sales-tax
planning reserves are already allocated at pack level, not charged to the admin.
Actual merchant fees/tax status, failed generations/refunds and invoice variance
prevent an unconditional profit guarantee. Live economics approval remains gated.

This change does not authorize or enable provider submissions or Stripe Live.
