// Operator sign-in for the dashboard. When the server reports that operator access is
// protected, the dashboard stays behind this screen until a phone number on the
// server's operator list signs in. The server checks every request; this screen only
// collects the Firebase ID token.
import {
  confirmOtp, friendlyAuthError, normalizeIndianPhone, sendOtp, signOutFirebase, watchIdToken,
} from "./account.js";

const api = window.chargeFlowApi;
const gate = document.getElementById("operatorGate");
const phoneForm = document.getElementById("operatorPhoneForm");
const codeForm = document.getElementById("operatorCodeForm");
const phoneInput = document.getElementById("operatorPhone");
const codeInput = document.getElementById("operatorCode");
const message = document.getElementById("operatorGateMessage");
const sentTo = document.getElementById("operatorCodeSentTo");
const recaptcha = document.getElementById("operatorRecaptcha");
const switchNumber = document.getElementById("operatorSwitchNumber");
const account = document.getElementById("operatorAccount");
const signOutButton = document.getElementById("operatorSignOut");

let config = null;
let signedInPhone = "";

function say(text, tone = "") {
  message.textContent = text;
  message.dataset.tone = tone;
}

function step(name) {
  phoneForm.hidden = name !== "phone";
  codeForm.hidden = name !== "code";
  switchNumber.hidden = name === "phone";
  (name === "code" ? codeInput : phoneInput).focus();
}

function showGate(reason = "") {
  if (!gate.hidden && !reason) return;
  gate.hidden = false;
  document.body.classList.add("operator-locked");
  say(reason);
  step(reason && signedInPhone ? "denied" : "phone");
}

function hideGate() {
  gate.hidden = true;
  document.body.classList.remove("operator-locked");
  say("");
}

function busy(form, on) {
  form.querySelectorAll("button, input").forEach((el) => { el.disabled = on; });
}

async function onToken(token, user) {
  api.token = token;
  signedInPhone = user?.phoneNumber || "";
  account.textContent = signedInPhone ? `Signed in as ${signedInPhone}.` : "";
  signOutButton.hidden = !signedInPhone;
  if (!token) { showGate(); return; }
  let status;
  try { status = await api.operatorAuth(); } catch { return; }
  if (status.signedIn) {
    hideGate();
    window.dispatchEvent(new Event("operator-signed-in"));
  } else {
    showGate(status.reason || "This number cannot open the operator dashboard.");
  }
}

phoneForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const phone = normalizeIndianPhone(phoneInput.value);
  if (!phone) { say("Enter a valid 10-digit Indian mobile number.", "error"); return; }
  busy(phoneForm, true);
  say("Sending a code…");
  try {
    await sendOtp(config, phone, recaptcha);
    sentTo.textContent = phone;
    codeInput.value = "";
    say("");
    step("code");
  } catch (error) {
    say(friendlyAuthError(error), "error");
  } finally { busy(phoneForm, false); }
});

codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = codeInput.value.replace(/\D/g, "");
  if (code.length !== 6) { say("Enter the 6-digit code from the SMS.", "error"); return; }
  busy(codeForm, true);
  say("Checking…");
  try {
    await confirmOtp(code); // onIdTokenChanged then asks the server whether this number is an operator.
  } catch (error) {
    say(friendlyAuthError(error), "error");
  } finally { busy(codeForm, false); }
});

async function signOut() {
  await signOutFirebase(config);
  api.token = "";
  signedInPhone = "";
  document.getElementById("operatorInfo")?.close();
  showGate();
}
switchNumber.addEventListener("click", signOut);
signOutButton.addEventListener("click", signOut);

// A refused request while the dashboard is open means the sign-in expired or was revoked.
// While the sign-in screen is already showing, the dashboard's background refreshes are
// refused every few seconds; they must not reset the screen while a code is being typed.
window.addEventListener("operator-auth-required", (event) => {
  if (config && gate.hidden) showGate(event.detail?.error || "Sign in again to continue.");
});

async function start() {
  let info;
  // An unreachable backend keeps the dashboard's browser simulation, which shows no real data.
  try { info = await api.operatorAuth(); } catch { return; }
  if (!info.required) return;
  config = info.firebase || null;
  showGate();
  if (!config?.apiKey) {
    busy(phoneForm, true);
    say("Operator sign-in is not configured on the server yet.", "error");
    return;
  }
  try { await watchIdToken(config, onToken); }
  catch { say("Could not load sign-in. Check your connection and reload.", "error"); }
}

start();
