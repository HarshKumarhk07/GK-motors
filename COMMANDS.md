# GK Motors — commands you run yourself

Nothing in this list runs from the website. The admin panel no longer prints
seed instructions; these are terminal commands only.

**Where to run them:** there is now a `package.json` in the repo root that
forwards to `server/` and `client/`, so every command below works from
`D:\Avani Projects\Car-service-website`. The scripts themselves still live in
`server/package.json` — that is why `npm run test:email` from the root used to
fail with `ENOENT ... package.json`.

---

## 1. You almost never need to seed the catalogue

The server seeds the 12 service categories and their 35 packages **itself, on
every startup** (`server/src/seeds/bootstrap.js`). It is idempotent — it adds
what is missing and leaves everything else alone, and it records a high-water
mark in the `appmeta` collection so a category you deliberately deleted is not
resurrected on the next boot.

So: `npm run dev` is normally all you need.

---

## 2. Commands worth knowing

```bash
# from the repo root

# Normal run
npm run dev:server          # nodemon API on :5000, auto-restarts on change
npm run dev:client          # Vite dev server on :5173
npm start                   # plain node API, what you use in production

# Catalogue
npm run seed                # add any missing categories/packages, without restarting
npm run seed:force          # ALSO restore categories you previously deleted
                            #   (clears the high-water mark first)

# Admin account
npm run seed:admin          # create the admin if none exists; prints the password ONCE
npm run seed:admin:reset    # regenerate the password for the existing admin

# Choose your own admin credentials instead of a generated password:
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='YourPass123!' npm run seed:admin

# Cars in the service catalogue
npm run seed:cars           # add Swift / Creta / City as a starter set
                            #   (then upload photos in Admin -> Services -> Cars)

# Email  — the recipient is an ARGUMENT, not part of the script name
npm run test:email you@example.com
# NOT: npm run test:email:you@example.com
# NOT: npm run test:you@example.com

# Spare-parts store categories (only if the parts catalogue is empty)
npm run seed:categories
```

Build:

```bash
npm run build               # production bundle into client/dist
npm run preview             # serve the built bundle locally to check it
npm run install:all         # reinstall dependencies in both folders
```

---

## 3. Which one do I want?

| Situation | Command |
|---|---|
| Fresh clone / new database | `npm run dev:server` — it seeds on boot |
| I deleted a category and want it back | `npm run seed:force` |
| I added a category in admin and it isn't showing | Nothing — just reload the page. Fixed in commit `5b83c83`. |
| I lost the admin password | `npm run seed:admin:reset` |
| Emails aren't arriving | `npm run test:email you@example.com`, then check Brevo |
| Booking flow has no cars to pick | `npm run seed:cars` |
| Parts pages are empty | `npm run seed:categories`, then add parts in admin |

---

## 4. Still on your plate

- **Rotate the secrets that were committed in `80d8477`.** They are in git
  history. New keys in `.env` do not undo that — the old ones must be revoked
  at Mongo Atlas, Cloudinary, Razorpay and Brevo.
- **Delete `_to_delete/`** in the repo root. I cannot remove files on your
  machine, only move them there. It holds stale git temp objects and old assets.
- **SMS / phone OTP provider** — deliberately skipped at your request.
