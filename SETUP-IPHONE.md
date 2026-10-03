# Install Christina on your iPhone (no computer needed)

GitHub builds the app on a cloud Mac and uploads it to Apple. You install it with Apple's **TestFlight** app. Everything below works in Safari on an iPhone.

You'll do the setup once. After that, a new version is one tap in GitHub.

> Apple only lets an app get onto an iPhone without a computer through TestFlight or the App Store. Both need the **Apple Developer Program** ($99/year). A free Apple ID can only install apps from a Mac or PC, and those apps expire after 7 days.

---

## 1. Join the Apple Developer Program (one time)

1. Install the **Apple Developer** app from the App Store.
2. Open it, go to **Account**, sign in with your Apple ID, then tap **Enroll Now** and pay.
3. Wait for the "Welcome to the Apple Developer Program" email. It can take up to 48 hours.

## 2. Find your Team ID

1. In Safari, open **developer.apple.com/account** and sign in.
2. Scroll to **Membership details**.
3. Copy the **Team ID**. It's 10 characters, like `A1B2C3D4E5`.

## 3. Register the app's identifier

1. Open **developer.apple.com/account/resources/identifiers/list**.
2. Tap **+**, choose **App IDs**, tap **Continue**, choose **App**, and tap **Continue**.
3. **Description:** `Christina`
4. **Bundle ID:** choose **Explicit** and enter something unique to you, for example `com.yourname.christina`. Write it down; you'll need it in steps 4 and 6.
5. Tap **Continue**, then **Register**. You don't need to tick any capabilities.

## 4. Create the app in App Store Connect

1. Open **appstoreconnect.apple.com** and go to **Apps**. Tap **+**, then **New App**.
2. Fill in the form:
   - **Platform:** iOS
   - **Name:** `Christina`. If that name is taken, add something, e.g. `Christina Journal`. Nobody else sees this name.
   - **Primary language:** your choice
   - **Bundle ID:** the one from step 3
   - **SKU:** `christina`
   - **User Access:** Full Access
3. Tap **Create**.

## 5. Create an App Store Connect API key

This key lets GitHub sign and upload the app for you.

1. In App Store Connect, go to **Users and Access**, then the **Integrations** tab, then **App Store Connect API**. Accept the terms if asked.
2. Under **Team Keys**, tap **+**.
3. **Name:** `GitHub`. **Access:** **Admin**. Admin is required so the cloud Mac can create the signing certificate.
4. Tap **Generate**.
5. Copy and save these somewhere safe, such as the Notes app:
   - **Issuer ID**, shown above the key list
   - **Key ID**, shown in the key's row
6. Tap **Download** to get the key file (`AuthKey_XXXXXXXXXX.p8`). **Apple lets you download it only once.**
7. Open the **Files** app, find the file in **Downloads**, and open it. It's plain text. Copy **all** of it, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines. If Files won't show the text, share the file to **Notes** and copy it from there.

## 6. Add the secrets to GitHub

1. In Safari, open **github.com/fc45mariko-byte/christina**.
2. If the mobile layout hides Settings, tap **aA** in the address bar and choose **Request Desktop Website**.
3. Go to **Settings**, then **Secrets and variables**, then **Actions**.

On the **Secrets** tab, tap **New repository secret** four times, once for each row:

| Name | Value |
|---|---|
| `ASC_KEY_ID` | Key ID from step 5 |
| `ASC_ISSUER_ID` | Issuer ID from step 5 |
| `ASC_KEY_P8` | Full text of the `.p8` file from step 5 |
| `APPLE_TEAM_ID` | Team ID from step 2 |

On the **Variables** tab, tap **New repository variable**:

| Name | Value |
|---|---|
| `BUNDLE_ID` | Bundle ID from step 3 |

## 7. Build and upload

1. In the repository, open **Actions** and select the **iOS** workflow.
2. Tap **Run workflow**. For branch, choose `claude/christina-ios-app`, or `main` once the app has been merged there. Leave **Build, sign and upload to TestFlight** ticked.
3. Tap **Run workflow**.
4. Wait for both jobs to show a green check. This takes about 10–15 minutes.

## 8. Install on the iPhone

1. Install **TestFlight** from the App Store.
2. In App Store Connect, open **Apps**, then **Christina**, then the **TestFlight** tab.
3. Wait until the build shows **Ready to Submit** or **Complete**. Apple's processing takes 5–30 minutes. If you're asked about **Missing Compliance**, choose **None of the algorithms mentioned above**. The app already declares that it uses no non-exempt encryption, so you normally won't see this.
4. Under **Internal Testing**, tap **+** to create a group, for example `Me`. Add yourself and tick the build.
5. Open the TestFlight invitation email on the iPhone and tap **View in TestFlight**, then **Install**.

Christina now appears on your home screen.

---

## Updating later

Repeat step 7. The new build appears in TestFlight automatically, and you tap **Update**.

Each TestFlight build works for **90 days**. Run step 7 again before then to keep using the app. Your data stays on the phone across updates.

## If the workflow fails

Open the failed run and tap the red step.

| Message | Fix |
|---|---|
| `Missing ASC_KEY_ID` (or another name) | That secret or variable is missing or misspelled. Repeat step 6. |
| `No profiles for '…' were found` or `bundle identifier … not available` | `BUNDLE_ID` doesn't match the identifier registered in step 3. |
| `Cloud signing permission error` | The API key isn't **Admin**. Create a new Admin key and repeat steps 5 and 6. |
| `No suitable application records were found` | Step 4 is missing, or the app there uses a different bundle ID. |
| `Invalid Pre-Release Train` / `version already used` | Run the workflow again. Every run gets a new build number. |
