# WebUI2 presentation and Render startup

## Explain the dashboard in 45 seconds

“Pluggo is an EV charging management project. This website is the operator
dashboard. The overview presents simulated charger occupancy, power demand,
queue size and solar contribution. Separate pages provide charging planning,
priority queue management, solar simulation and an emergency demonstration.
The browser sends HTTP requests to our C++ Crow API and uses its JSON responses
to update the interface. Vercel hosts the dashboard and proxies API requests to
the backend. The charging hardware and station telemetry are simulated.”

“The visual design uses transparent layers, 20px backdrop blur, soft reflective
edges and pill navigation. These provide an Apple-inspired glass appearance
using web CSS. Light and dark themes and responsive layouts support different
screens. The glass styling is presentation; the charging calculations run in
C++.”

## Suggested demonstration

1. Show Overview and explain the connection indicator and simulated values.
2. Open Schedule, enter current/target battery and a deadline, and submit.
   Explain that the browser receives the calculation from the C++ API.
3. Open Smart queue, add a sample vehicle, and explain priority ordering.
4. Run Solar energy simulation and explain solar use and grid fallback.
5. Show Emergency as a prototype response, not physical charger control.
6. Toggle appearance and resize the browser to show responsive placement.

For OOP questions, open `include/ev_system.hpp`: explain encapsulation in
Vehicle/Charger, composition in ChargingStation, overloaded
PricingEngine::calculateCost, and the SmartPriorityQueue template. Explain the
relevant module rather than claiming every screen calls every domain class.
There are no real payments or physical charger connections.

## Deploy the C++ backend to Render

The prepared free Blueprint is `deployment/render.yaml`. Render deployment has
not yet been completed. Docker compiles C++ and starts Nginx, the API and simulator;
no separate npm/Python build or start command is needed in Render.

1. Commit and push the updated project into a GitHub repository you can deploy.
   Include the C++ sources, frontend, seed catalogue, simulator and deployment
   files. Do not upload `secrets/`, `.env` files, local databases or build folders.
   The repository must contain the current files, not just the older Vercel site.
2. In [Render Dashboard](https://dashboard.render.com), choose **New → Blueprint**.
   Connect that repository and select its updated branch.
3. Set **Blueprint Path** to `deployment/render.yaml`. Review the free web service
   `pluggo-customer-demo`; this option does not attach paid storage.
4. Enter `PLUGGO_GATEWAY_KEY` when prompted. It must match the key already used
   by Vercel. From the repository on this Mac, copy it without displaying it:

   ```sh
   tr -d '\r\n' < secrets/operator_gateway_key.txt | pbcopy
   ```

   Paste into Render's environment-variable field, never a report or Git commit.
5. Click **Deploy Blueprint** and wait for the service to become Live. Its logs
   should show the C++ build and successful service startup. The health-check
   path is already configured as `/api/ready`.
6. Open `https://YOUR-SERVICE.onrender.com/api/health` and `/api/ready`. Both should
   return successful JSON responses. Keep the service origin for the next step.
7. Open Vercel project **oops → Settings → Environment Variables**. Update the
   **Production** value of `PLUGGO_CPP_ORIGIN` to
   `https://YOUR-SERVICE.onrender.com` (do not append `/api`). Ensure
   `PLUGGO_GATEWAY_KEY` matches Render. Keep both variables server-side; do not
   prefix them with a public browser variable name.
8. Redeploy Vercel Production so the new variables apply. Open
   [the dashboard health endpoint](https://oops-omega.vercel.app/api/health), then
   [WebUI2](https://oops-omega.vercel.app). Confirm **C++ connected** and submit a
   Schedule calculation. Until this succeeds, keep the local backend/tunnel
   running and the Mac awake and online.

After Render works, the website backend no longer depends on the Mac. The
gateway key restricts direct operator API access at Render; it is not a user
login system. The public Vercel dashboard remains a demonstration dashboard.

## Before presenting

- Open the Render health URL before the demonstration. Free services can sleep
  after inactivity and need about a minute to wake up.
- Free Render storage is ephemeral. SQLite changes can be lost on restart,
  redeployment or spin-down. Operator queue/solar state is also in memory.
- If Vercel says the backend is unavailable, check Render status and logs,
  matching gateway keys, the origin URL and whether Vercel was redeployed.
- A 401 from Render's direct `/api/station` URL without the gateway header is
  expected. Test through the Vercel dashboard instead.
- Browser checks passed for five dashboard pages at four viewport sizes and
  functional planner/queue/solar flows. The Render Docker runtime has not been
  executed locally; confirm its build and health checks during deployment.
- No APK was rebuilt for this change.

Official references: [Blueprint setup](https://render.com/docs/infrastructure-as-code),
[Docker deployment](https://render.com/docs/docker),
[Free service limits](https://render.com/docs/free).
