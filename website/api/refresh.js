// Redeploys the website when GitHub has a newer Pluggo release than the APK this deployment serves.
// The build copies the latest release APK into /download/, so a new release needs a new build.
// Called by a GitHub Action when a release is published, and by a daily Vercel cron as a backup.
// Safe to call by anyone: it only redeploys when the release tag changed and no build is running.
const REPO = "Bhumika-gaba23/EV-charging-management";
const API = "https://api.vercel.com";

async function latestTag() {
  // The releases/latest page redirects to /releases/tag/<tag>; this avoids the rate-limited API.
  const r = await fetch(`https://github.com/${REPO}/releases/latest`, { method: "HEAD", redirect: "manual" });
  const tag = (r.headers.get("location") || "").split("/tag/")[1];
  if (!tag) throw new Error(`could not read the latest release (${r.status})`);
  return decodeURIComponent(tag);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const latest = await latestTag();
    const servedReply = await fetch(`https://${req.headers.host}/download/version.txt`, { cache: "no-store" });
    const served = servedReply.ok ? (await servedReply.text()).trim() : "";
    if (served === latest) return res.status(200).json({ status: "up to date", version: latest });

    const token = process.env.REDEPLOY_TOKEN, team = process.env.VERCEL_TEAM_ID, project = process.env.VERCEL_PROJECT;
    if (!token || !team || !project) throw new Error("REDEPLOY_TOKEN, VERCEL_TEAM_ID or VERCEL_PROJECT is not set");

    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const list = await fetch(`${API}/v6/deployments?teamId=${team}&projectId=${project}&target=production&limit=1`, { headers: auth });
    if (!list.ok) throw new Error(`could not list deployments (${list.status})`);
    const [current] = (await list.json()).deployments || [];
    if (!current) throw new Error("no production deployment to rebuild");
    if (current.state !== "READY") return res.status(202).json({ status: "build already running", served, latest });

    const deploy = await fetch(`${API}/v13/deployments?teamId=${team}`, {
      method: "POST", headers: auth,
      body: JSON.stringify({ name: current.name, deploymentId: current.uid, target: "production" }),
    });
    const body = await deploy.json();
    if (!deploy.ok) throw new Error(`redeploy failed (${deploy.status}): ${body.error && body.error.message}`);
    return res.status(202).json({ status: "redeploying", served, latest, deployment: body.url });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};
