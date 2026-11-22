# Publishing Pluggo on Google Play

The Play build is a **Trusted Web Activity** (`deployment/android/store`): a small Android app
that opens the hosted Pluggo website full-screen in Chrome. It suits Play's policies for web
apps and uses Chrome's payment handling, so UPI apps open reliably from Razorpay. Every website
update reaches the app instantly. The older WebView test APK (`deployment/android/app`, with its
offline preview) is unchanged and stays useful for demos.

| | |
|---|---|
| Package name | `com.pluggo.app` (permanent once uploaded; change it with `PLUGGO_APPLICATION_ID` before the first upload if you want another) |
| Target API | 36, as Play requires for new apps and updates |
| Opens | `https://<PLUGGO_HOST>/#home` |

## 1. Create the upload key (once)

```sh
keytool -genkeypair -v -keystore deployment/pluggo-upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000
```

Create `deployment/android/keystore.properties` (both files are git-ignored):

```
storeFile=../pluggo-upload.jks
storePassword=<the password you chose>
keyAlias=upload
keyPassword=<the same password>
```

**Back up the `.jks` file and password somewhere safe** (a password manager). With Play App
Signing, a lost upload key can be reset through Play support, but it takes days.

## 2. Build

```sh
PLUGGO_HOST=pluggo-customer-demo.onrender.com VERSION_CODE=1 VERSION_NAME=1.0.0 sh deployment/build-store.sh
```

This produces `deployment/store/pluggo-1.0.0.aab` (upload this), a test APK, and
`frontend/.well-known/assetlinks.json`. Increase `VERSION_CODE` for every upload. If you move to
your own domain (see `deployment/vm`), use it as `PLUGGO_HOST`.

## 3. Publish the asset links

Commit `frontend/.well-known/assetlinks.json` and deploy the website. Check it at
`https://<host>/.well-known/assetlinks.json`. Without it, the app shows a browser address bar.

## 4. Play Console

1. Create a developer account at play.google.com/console (one-time US$25). A personal account
   needs identity verification; an organization account needs a D-U-N-S number.
2. **Create app** → name *Pluggo*, app, free.
3. **App integrity → App signing:** keep Play App Signing on. Copy the *App signing key
   certificate* SHA-256, then rebuild with `PLAY_SIGNING_SHA256=<it> sh deployment/build-store.sh`
   and deploy the updated `assetlinks.json`, so the app Play installs is trusted too.
4. **Testing → Closed testing:** upload the `.aab`. New personal accounts must run a closed test
   with at least **12 testers for 14 days** before production access.
5. **Store listing:** short and full description, 512×512 icon, 1024×500 feature graphic, and at
   least 2 phone screenshots (`docs/ui-audit` has some to start from).
6. **App content:**
   - Privacy policy: `https://<host>/privacy.html`
   - Account deletion: `https://<host>/privacy.html#delete-account`
   - Data safety: collects **phone number** (account management, app functionality) and
     **purchase history** (app functionality); data encrypted in transit; users can request
     deletion; not shared for advertising; approximate location is used on the device and
     not collected.
   - Target audience: 18+. Ads: none. Content rating: complete the questionnaire (no
     sensitive content).
7. Fill in `frontend/legal.json` (operator name, contact email, address) so the policy pages show
   real contact details. Play shows the developer email on the listing too.

## 5. Before production

- Switch Razorpay to live keys after KYC, and set the live webhook secret.
- Run the release on a real phone: install the test APK with `adb install`, confirm there is
  no address bar, sign in, pay with UPI, and delete a test account.
