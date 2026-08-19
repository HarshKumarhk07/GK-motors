# GK Motors — commands you run yourself

Nothing in this list runs from the website. The admin panel no longer prints
seed instructions; these are terminal commands only.

Run everything from the `server/` folder unless stated otherwise.

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
cd server

# Normal run
npm run dev                 # nodemon, auto-restarts on file change
npm start                   # plain node, what you use in production

# Catalogue
npm run seed                # add any missing categories/packages, without restarting
npm run seed:force          # ALSO restore categories you previously deleted
                            #   (clears the high-water mark first)

# Admin account
npm run seed:admin          # create the admin if none exists; prints the password ONCE
npm run seed:admin:reset    # regenerate the password for the existing admin

# Choose your own admin credentials instead of a generated password:
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='YourPass123!' npm run seed:admin

# Email
npm run test:email          # sends a test mail through Brevo using your .env keys

# Spare-parts store categories (only if the parts catalogue is empty)
npm run seed:categories
```

Frontend:

```bash
cd client
npm run dev                 # Vite dev server on :5173
npm run build               # production bundle into client/dist
npm run preview             # serve the built bundle locally to check it
```

---

## 3. Which one do I want?

| Situation | Command |
|---|---|
| Fresh clone / new database | `npm run dev` — it seeds on boot |
| I deleted a category and want it back | `npm run seed:force` |
| I added a category in admin and it isn't showing | Nothing — just reload the page. Fixed in commit `5b83c83`. |
| I lost the admin password | `npm run seed:admin:reset` |
| Emails aren't arriving | `npm run test:email`, then check the Brevo dashboard |
| Parts pages are empty | `npm run seed:categories`, then add parts in admin |

---

## 4. Still on your plate

- **Rotate the secrets that were committed in `80d8477`.** They are in git
  history. New keys in `.env` do not undo that — the old ones must be revoked
  at Mongo Atlas, Cloudinary, Razorpay and Brevo.
- **Delete `_to_delete/`** in the repo root. I cannot remove files on your
  machine, only move them there. It holds stale git temp objects and old assets.
- **SMS / phone OTP provider** — deliberately skipped at your request.
