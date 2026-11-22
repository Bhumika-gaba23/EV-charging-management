// Phone sign-in (Firebase Authentication) and Razorpay Checkout, loaded only when the
// server reports that they are configured. The server verifies the Firebase ID token and
// the Razorpay signature; nothing here is trusted on its own.
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const RAZORPAY_SDK = "https://checkout.razorpay.com/v1/checkout.js";

let firebase = null;
let confirmation = null;
let verifier = null;

async function loadFirebase(config) {
  if (firebase) return firebase;
  const [{ initializeApp }, auth] = await Promise.all([
    import(`${FIREBASE_SDK}/firebase-app.js`),
    import(`${FIREBASE_SDK}/firebase-auth.js`),
  ]);
  const app = initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    appId: config.appId,
  });
  firebase = { auth: auth.getAuth(app), sdk: auth };
  firebase.auth.languageCode = "en";
  return firebase;
}

export function normalizeIndianPhone(raw) {
  const digits = String(raw).replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export async function sendOtp(config, phone, recaptchaElement) {
  const { auth, sdk } = await loadFirebase(config);
  resetVerifier();
  // reCAPTCHA can be rendered into an element only once, so every attempt gets a fresh one.
  const host = document.createElement("div");
  recaptchaElement.replaceChildren(host);
  verifier = new sdk.RecaptchaVerifier(auth, host, { size: "invisible" });
  try {
    confirmation = await sdk.signInWithPhoneNumber(auth, phone, verifier);
  } catch (error) {
    resetVerifier();
    throw error;
  }
}

function resetVerifier() {
  if (verifier) { try { verifier.clear(); } catch {} }
  verifier = null;
}

export async function confirmOtp(code) {
  if (!confirmation) throw new Error("Request a new code first.");
  const credential = await confirmation.confirm(code);
  return credential.user.getIdToken(true);
}

// Calls back with a fresh ID token whenever the Firebase user signs in, out, or the
// token is refreshed (about hourly); "" means signed out.
export async function watchIdToken(config, callback) {
  const { auth, sdk } = await loadFirebase(config);
  return sdk.onIdTokenChanged(auth, async (user) => callback(user ? await user.getIdToken() : "", user));
}

// Milliseconds since the current Firebase user last signed in (Infinity when nobody is).
export async function firebaseSignInAge(config) {
  const { auth } = await loadFirebase(config);
  await auth.authStateReady?.();
  const user = auth.currentUser;
  return user ? Date.now() - Date.parse(user.metadata.lastSignInTime) : Infinity;
}

// Deletes the Firebase phone sign-in record after the Pluggo account itself has been erased.
export async function deleteFirebaseUser(config) {
  if (!config) return;
  const { auth, sdk } = await loadFirebase(config);
  await auth.authStateReady?.();
  if (auth.currentUser) await sdk.deleteUser(auth.currentUser);
}

export async function signOutFirebase(config) {
  if (!config) return;
  try { const { auth, sdk } = await loadFirebase(config); await sdk.signOut(auth); } catch {}
}

export function friendlyAuthError(error) {
  const code = error?.code || "";
  if (code.includes("invalid-verification-code")) return "That code is not right. Check the SMS and try again.";
  if (code.includes("code-expired")) return "That code has expired. Send a new one.";
  if (code.includes("too-many-requests")) return "Too many attempts. Wait a few minutes and try again.";
  if (code.includes("invalid-phone-number")) return "Enter a valid 10-digit Indian mobile number.";
  if (code.includes("unauthorized-domain") || code.includes("app-not-authorized"))
    return "This website is not yet allowed in Firebase. Add it under Authentication → Settings → Authorized domains.";
  if (code.includes("api-key-not-valid") || code.includes("invalid-api-key"))
    return "Phone sign-in is not set up correctly (Firebase API key). Please try again later.";
  if (code.includes("billing")) return "SMS sign-in needs the Firebase pay-as-you-go plan, or use a Firebase test number.";
  return error?.message || "Sign-in failed. Please try again.";
}

let razorpayLoading = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  razorpayLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SDK;
    script.onload = resolve;
    script.onerror = () => { razorpayLoading = null; reject(new Error("Could not load the payment window. Check your connection.")); };
    document.head.append(script);
  });
  return razorpayLoading;
}

// Opens Razorpay Checkout for a server-created order and resolves with the signed result.
export async function payWithRazorpay(order, { description }) {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "Pluggo",
      description,
      prefill: order.phone ? { contact: order.phone } : {},
      theme: { color: "#111214" },
      handler: (result) => resolve(result),
      modal: { ondismiss: () => reject(Object.assign(new Error("Payment cancelled."), { cancelled: true })) },
    });
    checkout.on("payment.failed", (event) =>
      reject(new Error(event?.error?.description || "Payment failed. No money was taken.")),
    );
    checkout.open();
  });
}
