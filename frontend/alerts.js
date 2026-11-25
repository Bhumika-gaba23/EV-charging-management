// Charging alerts: "charge complete", booking reminders and fault-report updates.
// In the Pluggo Android app they go to the phone through a native bridge (PluggoNative), whose
// alarms fire even when Pluggo is closed. In a browser or the Play Store app they use the web
// Notification API, which works while Pluggo is open or in a background tab.
const KEY = "pluggo.alerts", SCHEDULE_KEY = "pluggo.alerts.scheduled";
const native = () => window.PluggoNative;
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
let wanted = read(KEY, false) === true;
// tag -> time, for everything handed to the phone or a timer, so a later sync can cancel it.
const scheduled = new Map(Object.entries(read(SCHEDULE_KEY, {})));
const timers = new Map();
const send = (message) => native()?.postMessage(JSON.stringify(message));

export const alertsSupported = () => !!native() || "Notification" in window;
export const alertsOn = () => wanted && (!!native() || ("Notification" in window && Notification.permission === "granted"));

// Messages from the app: permission answers, and button presses from the charging notification
// or the car screen ({type: "command", action: "stop" | "pause" | "resume", session}).
let permissionWaiter = null, commandHandler = null;
function listen() {
  const bridge = native();
  if (!bridge || bridge.onmessage) return;
  bridge.onmessage = (event) => {
    let reply; try { reply = JSON.parse(event.data); } catch { return; }
    if (reply.type === "permission") permissionWaiter?.(!!reply.granted);
    else if (reply.type === "command") commandHandler?.(reply.action, reply.session);
  };
}
export function onNativeCommand(handler) { commandHandler = handler; listen(); }
// The live charge and nearby chargers, for the phone's charging notification and the car screen.
export function shareLive(payload) { if (native()) { listen(); send({ type: "live", ...payload }); } }
function nativePermission() {
  listen();
  return new Promise((resolve) => {
    const done = (granted) => { permissionWaiter = null; clearTimeout(timer); resolve(granted); };
    const timer = setTimeout(() => done(false), 60000);
    permissionWaiter = done;
    send({ type: "permission" });
  });
}
let worker = null;
async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  try { worker ||= await navigator.serviceWorker.register("sw.js", { scope: "./" }); return worker; } catch { return null; }
}
// Asks for notification permission. Returns true when alerts can be shown.
export async function enableAlerts() {
  let granted = false;
  if (native()) granted = await nativePermission();
  else if ("Notification" in window) {
    granted = (await Notification.requestPermission()) === "granted";
    if (granted) await registration();
  }
  wanted = granted;
  write(KEY, granted);
  return granted;
}
export function disableAlerts() {
  wanted = false;
  write(KEY, false);
  syncSchedule(new Map(), true);
}
export async function notify(tag, title, body) {
  if (!alertsOn()) return false;
  if (native()) { send({ type: "notify", tag, title, body }); return true; }
  try {
    const reg = await registration();
    if (reg) await reg.showNotification(title, { body, tag, icon: "assets/pluggo.svg", badge: "assets/pluggo.svg" });
    else new Notification(title, { body, tag, icon: "assets/pluggo.svg" });
    return true;
  } catch { return false; }
}
// desired: Map(tag -> {at, title, body}). Schedules new alerts and cancels ones no longer wanted.
export function syncSchedule(desired, force = false) {
  if (!alertsOn() && !force) desired = new Map();
  const now = Date.now();
  for (const [tag, item] of desired) {
    if (item.at <= now + 5000 || scheduled.get(tag) === item.at) continue;
    scheduled.set(tag, item.at);
    if (native()) send({ type: "schedule", tag, at: item.at, title: item.title, body: item.body });
    else {
      clearTimeout(timers.get(tag));
      // A timer only fires while this page lives; keep it to the next few hours.
      if (item.at - now < 6 * 3600000) timers.set(tag, setTimeout(() => { timers.delete(tag); notify(tag, item.title, item.body); }, item.at - now));
    }
  }
  for (const tag of [...scheduled.keys()]) {
    if (desired.get(tag)?.at === scheduled.get(tag)) continue;
    scheduled.delete(tag);
    if (native()) send({ type: "cancel", tag });
    clearTimeout(timers.get(tag)); timers.delete(tag);
  }
  write(SCHEDULE_KEY, Object.fromEntries(scheduled));
}
