# Instalarea site-ului Dental Arena pe cPanel

Site-ul și CRM-ul sunt o singură aplicație Node.js. Pe cPanel rulează din **Setup Node.js App**.
Baza de date este un singur fișier (SQLite), deci nu trebuie creată o bază MySQL.

## Ce vă trebuie

- Un cont cPanel cu **Setup Node.js App** (Node.js **22**). Dacă nu îl vedeți în cPanel, cereți-l firmei de hosting.
- Arhiva `dental-arena-cpanel.zip`, făcută cu `npm run build:cpanel`.
- Acces la **File Manager** și la **Cron Jobs** din cPanel.

## Pașii, prima instalare

### 1. Încărcați arhiva

1. În **File Manager**, intrați în folderul principal al contului (de exemplu `/home/utilizator`).
2. Încărcați `dental-arena-cpanel.zip` și alegeți **Extract**. Rezultă folderul `dental-arena`.
3. Creați, tot în folderul principal, un folder pentru date: `dentalarena-date`.
   Aici stau baza de date, fotografiile încărcate din panou și documentele pacienților.
   Fiind în afara folderului aplicației, nu se pierd la actualizări.

### 2. Fișierul `.env`

1. În folderul `dental-arena`, copiați `.env.example` cu numele `.env`.
2. Deschideți `.env` cu **Edit** și completați:

| Variabila | Ce scrieți |
|---|---|
| `DATABASE_URL` | `file:/home/utilizator/dentalarena-date/dental-arena.db` |
| `STORAGE_DIR` | `/home/utilizator/dentalarena-date/storage` |
| `APP_URL` | `https://dentalarena.ro` |
| `AUTH_SECRET` | un text aleator lung (vezi mai jos) |
| `PII_ENCRYPTION_KEY` | o cheie aleatoare de 32 de octeți, în base64 (vezi mai jos) |
| `CRON_SECRET` | alt text aleator lung |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | datele contului de e-mail, din cPanel → Email Accounts → Connect Devices |
| `MAIL_FROM` | `Dental Arena <office@dentalarena.ro>` |

Înlocuiți `utilizator` cu numele contului cPanel.

Pentru valorile aleatoare, în cPanel → **Terminal** (sau pe orice calculator cu Node.js):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # AUTH_SECRET și CRON_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"      # PII_ENCRYPTION_KEY
```

**Păstrați o copie a fișierului `.env` într-un loc sigur.** Fără `PII_ENCRYPTION_KEY` CNP-urile pacienților nu mai pot fi citite.

### 3. Aplicația Node.js

În cPanel → **Setup Node.js App** → **Create Application**:

| Câmp | Valoare |
|---|---|
| Node.js version | 22 |
| Application mode | Production |
| Application root | `dental-arena` |
| Application URL | `dentalarena.ro` |
| Application startup file | `app.js` |

Apăsați **Create**, apoi **Start App** (sau **Restart**).

La prima pornire aplicația:
- creează baza de date cu clinicile, medicii, serviciile și prețurile de pe site-ul actual;
- aplică actualizările bazei de date.

Nu este nevoie de **Run NPM Install**: arhiva conține deja tot ce trebuie.

### 4. Prima intrare în CRM

1. Deschideți `https://dentalarena.ro/crm/login`.
2. Intrați cu `admin@dentalarena.ro` și parola `parola-demo-2026`.
3. Aplicația vă cere imediat o parolă nouă.
4. Din **Echipă** schimbați e-mailurile și parolele conturilor de recepție și ale medicilor, și bifați clinica fiecăruia.
5. Din **Setări** completați datele firmei (denumire, CUI, Reg. Com., sediu, IBAN).
6. Din **Fotografii site** și din profilul fiecărui medic încărcați fotografiile.
7. Din **Servicii și prețuri** verificați prețurile.
8. Din **Echipă → Program** puneți programul real al medicilor, apoi din **Locații** bifați „Programul apare pe site”.

### 5. Reamintirile automate (Cron Jobs)

În cPanel → **Cron Jobs** adăugați două sarcini (înlocuiți `SECRETUL` cu valoarea `CRON_SECRET` din `.env`):

| Când | Comanda |
|---|---|
| La fiecare 15 minute (`*/15 * * * *`) | `curl -s -H "Authorization: Bearer SECRETUL" https://dentalarena.ro/api/cron/reminders > /dev/null` |
| O dată pe zi, la 3:30 (`30 3 * * *`) | `curl -s -H "Authorization: Bearer SECRETUL" https://dentalarena.ro/api/cron/maintenance > /dev/null` |

Prima trimite pacienților reamintirea cu 24 de ore înainte. A doua curăță datele vechi, conform politicii GDPR.

## Actualizări

1. Faceți arhiva nouă cu `npm run build:cpanel`.
2. În **Setup Node.js App** apăsați **Stop App**.
3. În File Manager ștergeți conținutul folderului `dental-arena`, **în afară de `.env`**, apoi încărcați și extrageți arhiva nouă.
4. **Start App**. Actualizările bazei de date se aplică singure la pornire.

Datele din `dentalarena-date` nu se ating la actualizare.

## Copii de siguranță

Faceți regulat o copie a folderului `dentalarena-date` și a fișierului `.env`, din cPanel → **Backup** sau descărcându-le din File Manager. Recomandat: zilnic.

## Dacă ceva nu merge

- **Pagina arată o eroare la pornire.** În **Setup Node.js App**, deschideți fișierul de log (de obicei `stderr.log` în folderul aplicației). Mesajele aplicației încep cu `[dental-arena]` sau `[env]` și spun ce variabilă lipsește.
- **„better-sqlite3” sau „sharp” nu se încarcă.** Serverul are o altă versiune de Node.js sau de Linux decât calculatorul pe care s-a făcut arhiva. Verificați că versiunea este 22. Dacă eroarea rămâne, în **Terminal**, în folderul `dental-arena`, rulați `npm rebuild better-sqlite3 sharp` (după ce activați mediul Node din comanda afișată sus în Setup Node.js App).
- **Nu pleacă e-mailurile.** Verificați datele SMTP din `.env`. Fără `SMTP_HOST`, e-mailurile sunt doar scrise în log.
