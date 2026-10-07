# Building the store apps

The store app opens the published game (https://shadow-society.lovable.app). Publish first, then:

1. Export the project to GitHub (Lovable: + menu → GitHub), clone it, run `npm install`.
2. Add platforms: `npx cap add android` and/or `npx cap add ios` (iOS needs a Mac with Xcode).
3. `npx cap sync`
4. Android: `npx cap open android` → build/sign in Android Studio → upload to Google Play Console ($25 one-time).
   iOS: `npx cap open ios` → archive in Xcode → upload to App Store Connect ($99/year).

## AdMob (1,450-coin reward video)
1. Create an AdMob account, add the Android and iOS apps, create a Rewarded ad unit for each.
2. Put the AdMob App ID in `android/app/src/main/AndroidManifest.xml`
   (`com.google.android.gms.ads.APPLICATION_ID` meta-data) and in `ios/App/App/Info.plist` (`GADApplicationIdentifier`).
3. Send the rewarded ad unit IDs so the in-app "Watch video" button can be wired with server-side reward verification.
