# Firebase Cloud Messaging setup

Report-status notifications use Firebase Cloud Messaging. Keep Firebase service
account credentials on the backend only.

Configure either `GOOGLE_APPLICATION_CREDENTIALS` with the absolute path to a
Firebase service-account JSON file, or set these backend environment values:

```text
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

The Flutter build reads the public Firebase application identifiers listed in
`Users/.env.example`. `Users/run-android.ps1` forwards them as Dart defines.
Never place the backend private key in the Flutter environment file.
