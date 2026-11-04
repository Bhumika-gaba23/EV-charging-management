// Device hints select a rendering budget, not a promise of measured frame rate.
export function choosePerformanceProfile({requested, memory=0, cores=0, saveData=false, mobile=false}={}) {
  if (["full","lite","poster"].includes(requested)) return requested;
  return mobile || saveData || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4) ? "lite" : "full";
}
export function getPerformanceProfile() {
  return choosePerformanceProfile({
    requested:new URLSearchParams(location.search).get("performance"),
    memory:navigator.deviceMemory,
    cores:navigator.hardwareConcurrency,
    saveData:navigator.connection?.saveData,
    mobile:matchMedia("(pointer:coarse)").matches || /Android/i.test(navigator.userAgent),
  });
}
export const performanceProfile = typeof document === "undefined" ? "full" : getPerformanceProfile();
if (typeof document !== "undefined") document.documentElement.dataset.performance = performanceProfile;
