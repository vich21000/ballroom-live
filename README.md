# Ballroom Live Seat Reservation

This version shares seat changes live between phones and computers. It is designed for GitHub Pages plus Firebase Realtime Database.

## 1. Create Firebase project

1. Open Firebase Console and create a project.
2. Add a **Web app**.
3. Open **Build > Authentication > Sign-in method** and enable **Anonymous**.
4. Open **Build > Realtime Database**, create a database, and choose a region near your users.
5. In Realtime Database **Rules**, paste the contents of `database.rules.json`, then publish.
6. Open Project settings > Your apps > SDK setup and configuration.
7. Copy the configuration values into `firebase-config.js`.
8. Make sure `databaseURL` exactly matches the URL shown by Realtime Database.

## 2. Test locally

Browsers block JavaScript modules when opening files directly. Run a small local web server:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/?room=wedding-001
```

Use the same `room` value on every device to see the same live data.

## 3. Publish with GitHub Pages

1. Create a new GitHub repository.
2. Upload every file from this folder to the repository root.
3. Open repository **Settings > Pages**.
4. Under Build and deployment, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`, then save.
6. Open the published GitHub Pages URL and add a room, for example:

```text
https://YOUR-NAME.github.io/YOUR-REPOSITORY/?room=wedding-001
```

Use the **Copy live link** button to share the same room with your team.

## Important security note

This starter uses anonymous login. Anyone who has a room link can edit that room. For production use, add staff accounts and stronger database rules before sharing publicly.
