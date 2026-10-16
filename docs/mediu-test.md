# Mediul de test (site + CRM)

O copie completă a site-ului și a CRM-ului, cu pacienți, programări, cereri și facturi demonstrative,
ca să încercați totul înainte de lansare. Rulează gratuit pe **Render.com**.

- Google nu o indexează (robots.txt și `noindex`), deci nu încurcă site-ul dentalarena.ro.
- E-mailurile și SMS-urile nu pleacă: sunt doar scrise în jurnalul serviciului.
- Planul gratuit „adoarme” după 15 minute fără vizitatori. Prima deschidere după aceea durează
  aproximativ un minut, iar **datele revin la cele demonstrative** (tot ce ați modificat se pierde).
  Pentru o copie care păstrează datele: planul Starter (aprox. 7 $/lună) plus un disc (Disks, montat
  la `/app/data`).

## Instalarea, o singură dată (5 minute)

1. Intrați pe **https://render.com** și apăsați **Get Started**. Alegeți **GitHub** și intrați cu
   contul `Aerodeck112`.
2. În Dashboard: **+ New** → **Web Service**.
3. Alegeți **Existing Image** și scrieți la Image URL:
   ```
   ghcr.io/aerodeck112/dental-arena:test
   ```
   Apăsați **Connect**.
4. Completați:
   - **Name:** `dental-arena-test` (adresa va fi `https://dental-arena-test.onrender.com`)
   - **Region:** Frankfurt (EU Central)
   - **Instance Type:** **Free**
5. Apăsați **Deploy Web Service**. După 2–3 minute, sus apare adresa site-ului.

Nu trebuie completată nicio variabilă: secretele se generează singure, iar adresa o dă Render.

## Conturile de test

Adresa CRM-ului: adresa site-ului + `/crm/login`. Parola pentru toate conturile: `parola-demo-2026`.

| Cine | E-mail |
|---|---|
| Administrator (vede tot) | `admin@dentalarena.ro` |
| Recepție Cristești | `receptie.cristesti@dentalarena.ro` |
| Recepție Luduș | `receptie.ludus@dentalarena.ro` |
| Medic | `andrei.marcoci@dentalarena.ro` (și ceilalți medici, vezi `docs/demo-logins.md`) |

## Versiunile noi

La fiecare modificare urcată pe GitHub, GitHub face singur o imagine nouă (fila **Actions**,
„Mediu de test”). Ca Render s-o instaleze:

- **de mână:** în Render, la serviciu, **Manual Deploy** → **Deploy latest reference**;
- **sau automat:** în Render, **Settings** → **Deploy Hook** → copiați adresa. În GitHub, în depozit:
  **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, cu numele
  `RENDER_DEPLOY_HOOK` și adresa copiată.

## Dacă Render spune că nu poate descărca imaginea

Imaginea trebuie să fie publică. Pe GitHub: profilul `Aerodeck112` → **Packages** →
`dental-arena` → **Package settings** → **Change visibility** → **Public**.

## Pentru dezvoltatori

- Imaginea: `Dockerfile.test`. Pornirea: `scripts/test-env/start.cjs` (secretele, baza de date cu
  datele demonstrative datate de azi, apoi serverul Next.js).
- `SITE_MODE=test` (`src/lib/site-mode.ts`) oprește indexarea și păstrează parola demonstrativă
  (fără schimbarea obligatorie la prima intrare).
- Local: `docker build -f Dockerfile.test -t dental-arena:test . && docker run -p 3000:10000 dental-arena:test`.
