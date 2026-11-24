# Launch checklist

What is left before Pluggo takes real money from real drivers. Most of it is paperwork, not code.
The build steps for the Play Store app are in [publishing on Google Play](play-store-release.md).

## 1. Razorpay live mode

Pluggo already verifies payment signatures, recovers payments when the app closes mid-checkout, and
processes webhooks and refunds. Only the account and keys change.

1. **Activate the account.** In the Razorpay Dashboard, complete *Account activation*: business type,
   PAN, bank account for settlements, business website (`https://<host>`) and the policy pages
   (`/privacy.html`, `/terms.html`). Razorpay checks that the site shows prices, contact details and
   refund terms. Activation usually takes 2–5 working days.
2. **Create live keys.** Dashboard → switch to *Live mode* → Account & Settings → API keys →
   Generate. Save the secret straight into a password manager; it is shown once.
3. **Set them on the server.** On the Render service (Environment), replace the test values:
   `RAZORPAY_KEY_ID=rzp_live_…` and `RAZORPAY_KEY_SECRET=…`.
4. **Live webhook.** Live mode → Webhooks → Add: URL
   `https://<host>/api/customer/razorpay/webhook`, a new secret, and the events `order.paid`,
   `payment.captured`, `payment.failed`, `refund.processed` and `refund.failed`. Put the secret in
   `RAZORPAY_WEBHOOK_SECRET`.
5. **Redeploy**, then check `https://<host>/api/ready` shows `"payments":"razorpay"`.
6. **Prove it with real money.** Charge for about ₹2 with your own UPI, check the receipt and the
   Razorpay dashboard, then refund it from the operator dashboard (Recent vehicles → Refund). Make
   sure the refund appears on the receipt.
7. **Update the wording.** Settings → About and the Terms still say payments run in test mode.
   Change them once live payments are on.

## 2. Play Store data safety form

Answer *Play Console → App content → Data safety* as follows. It must match
[the privacy policy](../frontend/privacy.html).

| Data type (Play's names) | Collected | Shared | Why | Optional |
|---|---|---|---|---|
| Personal info → Phone number | Yes | No | Account management, app functionality | Required to charge when sign-in is on |
| Financial info → Purchase history | Yes | No | App functionality (receipts, refunds, wallet credit) | No |
| App activity → Other user-generated content (station ratings, comments, problem reports) | Yes | No | App functionality | Yes |
| App activity → Other actions (bookings) | Yes | No | App functionality | Yes |
| Location → Approximate location | Yes (rounded to ~100 m, only for station and trip searches) | No | App functionality | Yes |

Also declare:

- Data is encrypted in transit: **yes**.
- Users can ask for their data to be deleted: **yes**, in the app (Settings → Delete my account and
  data) and at `https://<host>/privacy.html#delete-account`.
- **No ads**, and no data shared with third parties for advertising. Razorpay and Firebase are
  *service providers*, which Play does not count as sharing.
- **Notifications** (Android 13+): the app asks for permission only when the driver turns on
  *Charging alerts* in Settings.

## 3. Server settings added with bookings and time-of-use pricing

| Variable | Default | Effect |
|---|---|---|
| `PLUGGO_TIME_OF_USE` | `on` | Off-peak (22:00–06:00 India time) is 20% cheaper and peak (18:00–22:00) 20% dearer. `off` charges each station's base rate all day. A charge keeps the rate it started with. |

Bookings, ratings, fault reports and wallet credit need no settings. Their tables are created
automatically the first time the new server starts, so existing databases keep working.

## 4. Before you announce it

- Fill in `frontend/legal.json` (operator name, contact email, address).
- Register the operator numbers in `PLUGGO_OPERATOR_PHONES` so someone can resolve fault reports.
- Run a booking, a charge, a fault report and a resolution with credit on a real phone.
- Charging alerts in the WebView test APK are scheduled on the phone and do not survive a reboot.
  In the Play Store app they come from Chrome while Pluggo is open or in the background. Neither
  uses a push server, so an alert can be late if the phone kills Pluggo to save battery.
