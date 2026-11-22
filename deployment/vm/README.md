# Always-on hosting on a VM

Render's free plan sleeps after 15 minutes and keeps the database in a temporary folder.
For real users, run the same container on a machine that never sleeps. This folder sets up
the app behind [Caddy](https://caddyserver.com) (automatic HTTPS, WebSockets for chargers)
with a persistent data volume.

**Free option:** an Oracle Cloud *Always Free* Ampere A1 VM (up to 4 ARM cores, 24 GB RAM).
Any Ubuntu 22.04/24.04 server works the same way (Hetzner, DigitalOcean, AWS Lightsail…).

## 1. Create the VM (Oracle Cloud)

1. Sign up at cloud.oracle.com (a card is needed for verification; Always Free resources
   are not charged).
2. Compute → Instances → **Create instance**: image *Canonical Ubuntu 24.04*, shape
   *VM.Standard.A1.Flex* (2 OCPUs, 12 GB is plenty). Add your SSH key.
3. Networking → the instance's VCN → Security List → add **ingress rules** for TCP 80 and 443
   from `0.0.0.0/0`.
4. Point a domain at the VM: create a DNS **A record** (for example `app.yourdomain.in`) with
   the instance's public IP. A free subdomain from DuckDNS also works.

## 2. Install and start

SSH into the VM, then:

```sh
curl -fsSL https://raw.githubusercontent.com/Bhumika-gaba23/EV-charging-management/main/deployment/vm/setup.sh -o setup.sh
sh setup.sh https://github.com/Bhumika-gaba23/EV-charging-management.git
```

The first run installs Docker, opens ports 80/443 in the VM firewall, clones the repository
and creates `~/pluggo/deployment/vm/.env` with a random gateway key. Edit `.env`:
set `PLUGGO_DOMAIN` and copy the other values from Render's Environment page. Then:

```sh
cd ~/pluggo/deployment/vm && sh deploy.sh
```

Caddy obtains the HTTPS certificate on first start. Check `https://<domain>/api/ready`.

## 3. Update

```sh
cd ~/pluggo/deployment/vm && sh deploy.sh
```

pulls `main`, rebuilds, restarts and waits until the app reports ready. Customer data lives
in the `pluggo-data` Docker volume and survives updates and reboots. For an off-site copy,
also set the Litestream variables (see [deployment/README.md](../README.md)).

## 4. Switch clients over

- **APK / phones:** Android Back → Connection settings → enter `https://<domain>`. Rebuild the
  APK with the new default URL when you are ready (`deployment/android/.../MainActivity.java`).
- **Vercel dashboard:** set `PLUGGO_CPP_ORIGIN=https://<domain>` and the same
  `PLUGGO_GATEWAY_KEY`, then redeploy.
- **Firebase:** add the domain under Authentication → Settings → Authorized domains.
- **Razorpay:** point the webhook at `https://<domain>/api/customer/razorpay/webhook`.
- **Chargers:** Central System URL `wss://<domain>/ocpp/`.

## 5. Monitoring

Add a free [UptimeRobot](https://uptimerobot.com) HTTP monitor on `https://<domain>/api/ready`
(5-minute interval, alert by email or Telegram). `docker compose logs -f pluggo` shows live
logs, including every operator action and refund.

Once the VM is live you can disable `.github/workflows/keep-awake.yml`, which exists only to
stop Render's free plan from sleeping.
