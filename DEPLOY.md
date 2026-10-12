# Deploying BTB Solutions on the Synology NAS

Every push to `main` builds the app on GitHub and publishes it as a Docker image. The NAS only pulls that image. You never need SSH or git on the NAS.

Image: `ghcr.io/joelloveai/btb-solutions:latest` (also tagged with each commit)
Where to see it: https://github.com/Joelloveai?tab=packages (package **btb-solutions**)

> The image is built for Intel/AMD NAS models (`linux/amd64`), which is most Synology units. If your NAS has an ARM chip (for example some "J" and older value models), tell the developer so an ARM build can be added.

## 1. Make the image public (once)

So the NAS can pull it without a password:

1. Open https://github.com/Joelloveai?tab=packages and click **btb-solutions**.
2. **Package settings** (right side) -> scroll to **Danger Zone** -> **Change visibility** -> **Public** -> confirm.

The image contains only the app, no passwords or customer data. Secrets live in the `.env` file on the NAS.

## 2. Make the folders (once, in File Station)

In `docker` (shared folder) create `btb-solutions`, and inside it two folders: `data` and `uploads`. You should have:

```
/volume1/docker/btb-solutions/data       <- the database
/volume1/docker/btb-solutions/uploads    <- photos and documents (if R2 is not used)
```

Back these two folders up (Hyper Backup). Everything that matters is in them.

## 3. Create the `.env` file (once)

In `/volume1/docker/btb-solutions/` create a text file named exactly `.env` with this content (change the values). Use File Station's upload, or Text Editor on the NAS.

```
NEXTAUTH_SECRET=paste-a-long-random-string-here
INITIAL_ADMIN_EMAIL=you@yourcompany.com
INITIAL_ADMIN_PASSWORD=choose-a-strong-password

# Cloudflare R2 photo storage. Fill in ALL FOUR, or leave all four empty to keep photos on the NAS disk.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

- `NEXTAUTH_SECRET`: any long random text (40+ characters). Keep it the same forever; changing it signs everyone out.
- `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`: your first login. It is created only the first time, on an empty database. Add more office logins later from the app's own screens; you can delete these two lines after the first start.
- Do not put quotes around the values.

## 4. Create the project in Container Manager

1. Open **Container Manager** -> **Project** -> **Create**.
2. Project name: `btb-solutions`. Path: `/docker/btb-solutions` (the folder with your `.env`).
3. Source: **Create docker-compose.yml**, then paste the whole of `docker-compose.yml` from this repository (open it on GitHub: https://github.com/Joelloveai/btb-solutions/blob/main/docker-compose.yml, press the copy button).
4. Next, Next, **Done**. It pulls the image and starts. The first start takes a minute: it creates the database and your first login.

## 5. Let the internet reach it

The app listens on the NAS only (`127.0.0.1:3000`). In **Control Panel -> Login Portal -> Advanced -> Reverse Proxy** add a rule:

- Source: HTTPS, hostname `app.bobthebuilderz.com`, port 443
- Destination: HTTP, `localhost`, port `3000`

and give `app.bobthebuilderz.com` a certificate (Control Panel -> Security -> Certificate). Then open https://app.bobthebuilderz.com and sign in.

## Check that it is running

- Container Manager -> **Container** -> `btb-solutions` should say **Running**, and after about a minute **Healthy**.
- On the NAS, open `http://localhost:3000/api/health` in a browser; it shows `ok`.
- From anywhere: https://app.bobthebuilderz.com/login shows the sign-in page.

## View the logs

Container Manager -> **Container** -> `btb-solutions` -> **Details** -> **Log**. The start of the log shows "Applying database migrations" and, on the very first start, "Created the first login".

## Updating to a new version

After new code is pushed to `main` and the GitHub build (Actions tab) is green:
Container Manager -> **Project** -> `btb-solutions` -> **Action** -> **Build** (or Stop, then Start). It pulls the newest image and applies any database changes by itself. Your data and photos are untouched.

## If something is wrong

- **Won't pull the image**: the package is still private (step 1).
- **Restarts again and again**: open the log. a message about a missing setting or about R2 means the `.env` file is missing a value (a half-filled R2 block is refused on purpose).
- **Cannot sign in**: the first login is only created on an empty database. If the database already existed, ask the developer to add a login.
