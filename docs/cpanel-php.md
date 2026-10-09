# Instalarea site-ului Dental Arena pe cPanel (versiunea PHP)

Site-ul și panoul de administrare sunt scrise în PHP, cu bază de date MySQL. Merg pe orice cont
cPanel obișnuit, fără Node.js. Nu trebuie instalat nimic în plus și nu trebuie scrise comenzi.

Arhiva `dentalarena-php.zip` conține:

- `public_html/`: paginile site-ului, stilurile, fotografiile;
- `dentalarena/`: aplicația și setările. Stă **lângă** `public_html`, nu în el, ca să nu poată fi
  deschisă din browser;
- `CITESTE-MA.md`: acest ghid.

> **Recomandare:** instalați întâi o **copie de test** pe un subdomeniu (pasul A). Site-ul de acum
> rămâne neatins până când sunteți mulțumit. Apoi faceți instalarea pe dentalarena.ro (pasul B).

---

## A. Copia de test pe test.dentalarena.ro

### 1. Subdomeniul

1. cPanel → **Domains** (sau **Subdomains**) → **Create A New Domain**.
2. Scrieți `test.dentalarena.ro`.
3. Debifați „Share document root” și la **Document Root** scrieți: `test.dentalarena.ro/public_html`.
4. **Submit**.

### 2. Baza de date

1. cPanel → **MySQL Database Wizard**.
2. Pasul 1: numele bazei, de exemplu `datest` (cPanel îl face `contcpanel_datest`).
3. Pasul 2: un utilizator, de exemplu `datest`, cu o parolă generată (**Password Generator**). **Notați parola.**
4. Pasul 3: bifați **ALL PRIVILEGES** → **Make Changes**.

### 3. Versiunea de PHP

1. cPanel → **MultiPHP Manager**: bifați `test.dentalarena.ro`, alegeți **PHP 8.1** sau mai nou (8.2, 8.3) → **Apply**.
2. Dacă aveți **Select PHP Version**: la **Extensions** verificați că sunt bifate `pdo_mysql`, `mbstring`, `gd`, `exif`.

### 4. Fișierele

1. cPanel → **File Manager** → intrați în folderul `test.dentalarena.ro` (se află în folderul principal, de exemplu `/home/contcpanel/test.dentalarena.ro`).
2. **Upload** → alegeți `dentalarena-php.zip`. Așteptați până se termină.
3. Clic dreapta pe arhivă → **Extract** → **Extract Files**. În folder apar `public_html`, `dentalarena` și `CITESTE-MA.md`.

### 5. Instalarea

1. Deschideți **https://test.dentalarena.ro/admin/instalare**. Dacă browserul spune că adresa nu e sigură, așteptați câteva minute: cPanel face singur certificatul (sau cPanel → **SSL/TLS Status** → **Run AutoSSL**).
2. Pagina verifică serverul. Dacă un rând e roșu, scrie ce trebuie făcut.
3. Completați:
   - numele bazei de date, utilizatorul și parola de la pasul 2;
   - adresa: `https://test.dentalarena.ro`;
   - **Copie de test**: nu apare în Google, iar e-mailurile nu pleacă (se scriu în jurnal);
   - numele, e-mailul și parola dumneavoastră pentru panou.
4. **Instalați site-ul**. Apoi intrați în panou la **/admin** și încercați tot.

---

## B. Site-ul adevărat pe dentalarena.ro

1. **Copie de siguranță a site-ului vechi.** cPanel → **Backup** → **Download a Home Directory Backup**,
   sau măcar: File Manager → `public_html` → selectați tot → **Compress** → descărcați arhiva.
2. **Mutați site-ul vechi deoparte.** În folderul principal creați folderul `site-vechi`. Intrați în
   `public_html`, **Select All** → **Move** → `/site-vechi`. Lăsați `public_html` gol. (Dacă e nevoie,
   îl mutați înapoi la fel.)
3. **Baza de date:** ca la pasul A.2, cu alt nume, de exemplu `dentalarena`.
4. **PHP:** ca la A.3, pentru `dentalarena.ro`.
5. **Fișierele:** încărcați `dentalarena-php.zip` în **folderul principal** (`/home/contcpanel`, unde se
   află `public_html`) și dați **Extract**. Fișierele intră în `public_html`, iar `dentalarena` apare lângă el.
6. **Instalarea:** deschideți **https://dentalarena.ro/admin/instalare**, ca la A.5, dar alegeți
   **Site-ul public**.
7. **În panou (/admin):**
   - **Setări**: datele firmei (denumire, CUI, Reg. Com., sediu, IBAN), e-mailul care primește
     cererile, adresele, telefoanele și programul clinicilor (bifați „Programul apare pe site”);
   - **Servicii și prețuri**: verificați prețurile;
   - **Fotografii site** și **Echipa**: fotografiile;
   - **Echipa** → fiecare medic → **Unde lucrează**: bifați Cristești și/sau Luduș (după asta apare
     coloana lui în calendarul clinicii);
   - **Utilizatori**: conturile pentru recepție și medici, cu bifa Cristești și/sau Luduș. La un cont
     de medic alegeți și **Medicul** din echipă căruia îi aparține contul;
   - **Cron Jobs** pentru reamintiri (vedeți mai jos).
8. **Google:** în Google Search Console adăugați dentalarena.ro și trimiteți `https://dentalarena.ro/sitemap.xml`.
   Adresele vechi ale paginilor sunt aceleași, deci Google le găsește imediat.

---

## Ce face site-ul singur

- **Cererile de programare și mesajele** de pe site ajung în panou (**Cereri**) și pe e-mail
  (adresa din **Setări**). Pacientul primește o confirmare dacă și-a lăsat e-mailul.
- **Cererile închise** mai vechi decât perioada din **Setări** (implicit 365 de zile) se șterg singure (GDPR).
- **Protecție:** 10 parole greșite în 15 minute blochează intrarea pentru 15 minute; formularele
  resping roboții și cel mult 5 cereri la 10 minute din aceeași rețea.

## Programări și pacienți (panoul /admin)

- **Azi**: programările zilei la clinica aleasă, în ordine, cu butoanele pentru pasul următor
  (Confirmat, A sosit, Începe tratamentul, Finalizat, Nu a venit), alertele medicale ale pacientului,
  cererile noi de pe site și câți pacienți trebuie sunați pentru control.
- **Calendar**: ziua (o coloană pentru fiecare medic, rânduri de 15 minute; un clic pe un loc liber
  deschide o programare nouă acolo) sau săptămâna. Programul nu permite două programări suprapuse
  la același medic, decât dacă bifați „Programez oricum”.
- **Cereri online** → o cerere → **Faceți programarea**: datele pacientului se completează singure,
  iar cererea se leagă de programare.
- **Pacienți**: fișa (nr. fișei, CNP, date de contact, clinica și medicul), **anamneza** (alergii,
  medicamente, afecțiuni; cele bifate apar ca alertă roșie la fiecare programare), programările,
  rechemările și notele.
- **Rechemări**: lista pacienților de chemat la control (cele întârziate și cele din următoarele
  14 zile), cu Am sunat, Programați, Peste o lună, Nu dorește.
- **Cine ce vede:** fiecare utilizator vede doar clinicile bifate la contul lui. Anamneza completă și
  notele clinice le văd și le modifică doar administratorii și medicii; recepția vede doar alertele.
- **CNP-ul** se păstrează criptat în baza de date. Cheia de criptare este rândul `secret` din
  `dentalarena/config.php`: **dacă pierdeți fișierul `config.php`, CNP-urile salvate nu mai pot fi
  citite.** Păstrați o copie a lui (vedeți **Copii de siguranță**).

## Reamintiri pe e-mail (Cron Jobs)

Pacienții cu e-mail primesc o reamintire în ziua dinaintea programării (între orele 10 și 21), dacă
programarea a fost făcută cu cel puțin 18 ore înainte și au bifa „Primește reamintirea” în fișă.
Reamintirile pleacă și singure, când cineva lucrează în panou, dar ca să plece sigur la timp:

1. cPanel → **Cron Jobs** → **Add New Cron Job**;
2. **Common Settings**: **Once Per Hour** (`0 * * * *`);
3. **Command** (înlocuiți `contcpanel` cu numele contului cPanel, cel din File Manager → `/home/...`):

   ```
   php /home/contcpanel/dentalarena/cron.php
   ```

4. **Add New Cron Job**.

Pe copia de test e-mailurile nu pleacă: se scriu în `dentalarena/storage/logs/app.log`.

## E-mailurile ajung în Spam?

Implicit site-ul trimite prin serverul cPanel. Pentru o livrare mai bună, trimiteți prin contul
`office@dentalarena.ro`: în File Manager deschideți `dentalarena/config.php` cu **Edit** și înlocuiți
`'smtp' => NULL,` cu (datele din cPanel → **Email Accounts** → **Connect Devices**):

```php
'smtp' => ['host' => 'mail.dentalarena.ro', 'port' => 465, 'user' => 'office@dentalarena.ro', 'pass' => 'PAROLA-EMAILULUI'],
```

## Actualizări

1. Faceți o copie de siguranță (cPanel → **Backup**).
2. Încărcați noua `dentalarena-php.zip` în același loc ca prima dată și dați **Extract**, cu
   suprascriere. Setările (`dentalarena/config.php`), baza de date și fotografiile încărcate
   (`public_html/media`) rămân. Baza de date se actualizează singură la prima vizită.

## Copii de siguranță

cPanel → **Backup**: descărcați regulat **MySQL Database** (baza site-ului) și **Home Directory**.
Descărcați și fișierul `dentalarena/config.php` (File Manager → **Download**) și păstrați-l în
siguranță: conține parola bazei de date și cheia cu care sunt criptate CNP-urile. Fără el, CNP-urile
din copia bazei de date nu mai pot fi citite.

## Dacă ceva nu merge

- **„Lipsește folderul dentalarena”**: arhiva a fost dezarhivată în alt loc. Folderul `dentalarena`
  trebuie să fie lângă `public_html`, nu în el.
- **Eroare la conectarea la baza de date**: verificați numele complet al bazei și al utilizatorului
  (cu prefixul contului, de exemplu `contcpanel_datest`) și că utilizatorul are **ALL PRIVILEGES** pe bază.
- **O pagină afișează „Pagina nu a putut fi afișată”**: detaliile sunt în `dentalarena/storage/logs/app.log`.
- **Fotografiile nu se încarcă din panou**: activați extensia `gd` (Select PHP Version → Extensions)
  sau măriți `upload_max_filesize` (MultiPHP INI Editor), de exemplu la 16M.
- **Pagina /admin/instalare apare din nou**: fișierul `dentalarena/config.php` lipsește; puneți-l înapoi din copia de siguranță.
