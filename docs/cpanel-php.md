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
   - **Setări**: firma fiecărei clinici (denumire, CUI, Reg. Com., sediu, IBAN), e-mailul care primește
     cererile, adresele, telefoanele și programul clinicilor (bifați „Programul apare pe site”);
   - **Servicii și prețuri**: verificați prețurile;
   - **Fotografii site** și **Echipa**: fotografiile;
   - **Echipa** → fiecare medic → **Unde lucrează**: bifați Cristești și/sau Luduș (după asta apare
     coloana lui în calendarul clinicii);
   - **Utilizatori**: conturile pentru recepție și medici, cu bifa Cristești și/sau Luduș. La un cont
     de medic alegeți și **Medicul** din echipă căruia îi aparține contul;
   - **Setări → Facturare**: seria facturilor și a chitanțelor și numărul de la care continuați (dacă
     ați emis deja facturi din alt program), mențiunea despre TVA (verificați-o cu contabilul);
   - **Setări → Textele acordurilor**: citiți formularele de consimțământ și adaptați-le;
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

## Facturi, plăți, planuri, documente (etapa 3)

- **Planuri de tratament** (fișa pacientului → *Planuri de tratament*): medicul adaugă lucrările din
  lista de prețuri, pe dinți și pe faze, tipărește planul cu devizul pentru pacient, îl marchează
  „acceptat”, apoi bifează fiecare lucrare „Efectuat”.
- **Odontograma** (doar medici și administratori): apăsați pe un dinte, notați ce ați găsit (carie,
  obturație, coroană, extracție etc., pe suprafețe) și, dacă e cazul, „Adăugați în plan”.
- **Facturi** (administratori și recepție): din fișa pacientului → *Facturi și plăți* → **Factură
  nouă**. Lucrările efectuate din plan apar bifate; puteți adăuga și alte servicii. Încasarea se poate
  face pe loc (numerar, card, transfer). La numerar se dă **chitanță** cu număr. Factura și chitanța
  se tipăresc sau se salvează ca PDF din browser.
- Numerele de factură și de chitanță sunt **consecutive, fără goluri**. O factură emisă nu se șterge:
  un administrator o poate **anula** (cu motiv); plățile ei rămân în contul pacientului, ca avans.
- **Încasări**: jurnalul zilei (sau al unei perioade), pe metode de plată, cu export pentru contabil
  (Excel / CSV). Și lista facturilor are export.
- **Rapoarte**: facturat și încasat, venit pe medic și pe categorii, încasări pe metode, programări și
  neprezentări pe medic, cererile de pe site. Recepția și medicii văd doar partea de programări
  (medicul vede și producția lui).
- **Documente și acorduri**: radiografii, fotografii, PDF-uri (păstrate în `dentalarena/storage/documente`,
  în afara site-ului); formularele de consimțământ se tipăresc completate cu numele pacientului, iar
  după semnare se înregistrează (cu copia scanată, opțional).
- **GDPR** (administratori): din fișă → *GDPR* descărcați toate datele pacientului (dreptul de
  acces) sau anonimizați fișa (dreptul la ștergere; datele medicale și facturile rămân, cum cere
  legea). **Cereri GDPR** din meniu ține registrul cererilor, cu termenul de 30 de zile.
- **Jurnal** (administratori): cine ce a făcut în panou, inclusiv cine a deschis fiecare fișă.

> **Important despre facturi:** panoul emite facturi și chitanțe cu numerotare proprie. Trimiterea în
> **e-Factura (SPV ANAF)** și, dacă e cazul, bonul fiscal din casa de marcat nu se fac din panou.
> Stabiliți cu contabilul cum folosiți facturile din panou (de exemplu, exportul CSV lunar).

Documentele încărcate pot avea cel mult cât permite serverul: dacă o radiografie nu se încarcă, măriți
în cPanel → **MultiPHP INI Editor** valorile `upload_max_filesize` și `post_max_size` (de exemplu 25M).

## Mesaje: SMS, WhatsApp, e-mail (etapa 4)

Panoul trimite notificări la fiecare operațiune: programare făcută, mutată sau anulată, reamintirea
de a doua zi, factura, plata, rechemarea la control, mulțumirea după vizită, ziua de naștere, și
anunță echipa (programare nouă, anulare, pacient sosit, agenda zilei, cerere nouă de pe site,
mesaj nou pe WhatsApp). Totul se reglează din **Setări → Mesaje**.

**Pornirea:**

1. **Mod de probă** este pornit la început: mesajele nu pleacă, apar doar în **Mesaje** ca „Probă”.
   Lăsați-l așa pe copia de test.
2. **SMS (SMSLink.ro):** faceți cont pe smslink.ro, cumpărați credit, apoi **SMS Gateway →
   Configurare**: creați o conexiune și copiați **Connection ID** și parola în Setări → Mesaje.
   Pentru ca SMS-urile să apară de la „DentalArena” (nu de la un număr scurt), cereți la SMSLink
   aprobarea expeditorului și scrieți-l în câmpul „Expeditor”.
3. **WhatsApp (Meta, WhatsApp Business Platform):**
   - în business.facebook.com faceți (sau verificați) contul de firmă;
   - în developers.facebook.com creați o aplicație de tip „Business”, adăugați produsul WhatsApp și
     un număr de telefon dedicat (nu numărul folosit deja în aplicația WhatsApp de pe telefon);
   - copiați în Setări → Mesaje: **Phone number ID**, un **token permanent** (System User în
     Business Settings, cu permisiunile whatsapp_business_messaging și whatsapp_business_management)
     și **App Secret** (App Settings → Basic);
   - la **WhatsApp → Configuration → Webhook** puneți adresa și „Verify token” afișate în Setări →
     Mesaje și abonați câmpul **messages**; așa vedeți în panou livrarea, citirea și răspunsurile;
   - în **WhatsApp Manager → Message templates** cereți aprobarea șabloanelor de mai jos (limba
     română, categoria „Utility”, iar ultimele două „Marketing”) și scrieți numele fiecăruia în
     Setări → Mesaje, la notificarea lui. Fără șablon, pacienții cu WhatsApp primesc SMS.
4. Trimiteți un **mesaj de probă** (jos în Setări → Mesaje), apoi alegeți **Trimitere reală**.
5. Fiecare om din echipă își alege notificările în **Contul meu** (SMS, WhatsApp, e-mail) și își
   scrie telefonul.

Șabloanele WhatsApp (parametrii {{1}}, {{2}}… se completează automat, în ordinea de mai jos):

| Notificare | Nume propus | Text pentru Meta |
|---|---|---|
| Programare făcută | `programare_noua` | Bună ziua, {{1}}! Programarea dumneavoastră la Dental Arena este {{2}}, ora {{3}}, la {{4}} ({{5}}). Pentru modificări sunați la {{6}}. |
| Programare mutată | `programare_mutata` | Bună ziua, {{1}}! Programarea dumneavoastră a fost mutată pe {{2}}, ora {{3}}, la Dental Arena {{4}}. Întrebări: {{5}}. |
| Programare anulată | `programare_anulata` | Bună ziua, {{1}}! Programarea din {{2}}, ora {{3}}, a fost anulată. Pentru o programare nouă sunați la {{4}}. |
| Reamintire | `reamintire_programare` | Bună ziua, {{1}}! Vă așteptăm mâine, {{2}}, la ora {{3}}, la Dental Arena {{4}}. Dacă nu puteți veni, sunați la {{5}}. |
| Cerere primită | `cerere_primita` | Am primit cererea dumneavoastră de programare la Dental Arena. Vă sunăm în cel mult o zi lucrătoare. Urgențe: {{1}}. |
| Factură emisă | `factura_emisa` | Bună ziua, {{1}}! Factura {{2}}, în valoare de {{3}}, a fost emisă. Vă mulțumim! |
| Plată primită | `plata_primita` | Bună ziua, {{1}}! Am primit plata de {{2}}. Vă mulțumim! |
| Rechemare | `rechemare_control` | Bună ziua, {{1}}! Se apropie controlul periodic recomandat. Sunați-ne la {{2}} ca să stabilim ora potrivită. |
| După vizită (Marketing) | `multumire_vizita` | Bună ziua, {{1}}! Vă mulțumim pentru vizită. Ne lăsați o părere? {{2}} |
| La mulți ani (Marketing) | `la_multi_ani` | La mulți ani, {{1}}! Echipa Dental Arena vă dorește sănătate și zâmbete frumoase. |

Pentru campanii, faceți câte un șablon „Marketing” cu {{1}} = prenumele pacientului.

**Ce primește fiecare pacient:** în fișă alegeți „Notificările pe telefon”: SMS, WhatsApp sau
deloc; e-mailul se bifează separat. Ofertele (campanii, mulțumirea după vizită, la mulți ani) pleacă
**doar** pacienților care și-au dat acordul pentru acel canal (bifat în fișă, cu data, sau din
formularul de pe site), și au mereu link de dezabonare. Pacienților li se scrie doar între orele
alese (implicit 9–20; ofertele 10–20); mesajele către echipă pleacă imediat.

**Mesaje** (meniu): conversațiile WhatsApp (pacienții care v-au scris; răspundeți din fișa lor, în
24 de ore, cum cere WhatsApp) și jurnalul tuturor mesajelor, cu „Reîncercați” la cele eșuate.

**Marketing** (meniu, administratori): campanii pe SMS, WhatsApp sau e-mail, către pacienții cu
acord, filtrați după clinică, „fără vizită de N luni”, plan de tratament neterminat, ziua de naștere
sau un serviciu făcut. Vedeți înainte câți pacienți o primesc și câte SMS-uri înseamnă, vă trimiteți
o probă, apoi trimiteți acum sau programați.

> Completați **Politica de confidențialitate** cu: mesajele de notificare (SMS prin SMSLink,
> WhatsApp prin Meta), ofertele trimise doar cu acord și asistentul AI (Anthropic).

## Consultație cu AI (etapa 4)

În fișa pacientului, medicul apasă **Consultație cu AI**, apoi **Dictați** și vorbește (sau lasă
calculatorul/telefonul să asculte discuția cu pacientul). Dictarea merge în Chrome, Edge și Safari,
pe adresa cu https. **Analizați cu AI** propune: nota clinică, anamneza (alergii, medicamente,
afecțiuni), constatările pe dinți și lucrările pentru planul de tratament, plus ce trebuie verificat.
Medicul bifează ce e corect și apasă **Treceți în fișă ce e bifat**; nimic nu intră fără verificare.

**Pornirea:** pe console.anthropic.com faceți cont de firmă, adăugați o metodă de plată și creați
o **API key**; în **Setări → Asistentul AI** bifați „pornit”, lipiți cheia și apăsați **Testați
conexiunea**. Costul e de regulă de câțiva cenți pe consultație.

**Date personale:** înainte de trimitere, panoul scoate din text numele pacientului, CNP-ul și
numerele de telefon. Textul consultației rămâne totuși o informație despre sănătate, deci:
acceptați termenii comerciali Anthropic (cuprind acordul de prelucrare a datelor), menționați
furnizorul în Politica de confidențialitate și spuneți-i pacientului când înregistrați discuția.

## Semnarea acordurilor pe tabletă (etapa 5)

Pacientul semnează acordurile (GDPR, tratament, fotografii) pe o tabletă la recepție,
cu degetul, după un **cod din 6 cifre** primit de la recepționeră.

**O singură dată, pe tabletă:** deschideți pe tabletă `https://dentalarena.ro/admin/tablete`,
intrați cu contul de administrator și apăsați **Asociați această tabletă**. Contul se închide
singur pe tabletă (pacienții nu ajung în panou), iar tableta deschide de acum `/tableta`. Puneți
pagina pe ecranul de pornire și activați „Acces ghidat” (iPad) sau „Fixarea aplicației” (Android).
O tabletă pierdută se oprește din aceeași pagină (**Opriți**).

**La fiecare pacient:** în fișă → **Documente și acorduri** → **Semnare pe tabletă** bifați ce
semnează (și, la nevoie, chestionarul medical și acordul pentru oferte), apoi **Dați un cod**. Codul
e valabil 30 de minute, o singură dată. Pacientul îl introduce pe tabletă, citește textele, bifează,
completează chestionarul și semnează. În fișă vedeți pe loc „pacientul semnează acum”, apoi
acordurile trec la „Semnat pe tabletă”.

**Ce se păstrează:** textul exact semnat, semnătura (imagine în documentele pacientului), ora,
tableta și o amprentă SHA-256 a tuturor; la **acordul semnat** panoul verifică amprenta și arată dacă
documentul a rămas neschimbat. Chestionarul completat de pacient apare în fișă ca propunere:
medicul îl **trece în anamneză** (bolile bifate se adaugă, textele se adaugă la ce era scris) sau îl
pune deoparte. După 6 coduri greșite în 10 minute, tableta așteaptă.

## Programul zilei pentru medici, dimineața pe WhatsApp

În fiecare zi în care are programări, medicul primește dimineața lista lor: ora, pacientul,
motivul, clinica (dacă lucrează la amândouă) și, opțional, alertele medicale (alergii,
anticoagulante etc.). Dacă în aceeași zi se adaugă, se mută sau se anulează o programare, primește
și asta. Medicul nu are nevoie de cont în panou.

**Setarea:** Echipa → medic → **Programul zilei, pe telefon**: canalul (WhatsApp, SMS sau e-mail),
mobilul, ora (de exemplu 07:30) și dacă vrea alertele medicale. În dreapta vedeți cum arată
mesajul; butonul **Trimiteți acum programul medicului** trimite o probă.

**WhatsApp:** Meta cere un șablon aprobat pentru mesajele trimise de clinică. În Meta Business →
WhatsApp Manager → Message templates creați un șablon de categoria **Utility**, limba română, cu
textul: „Bună dimineața, {{1}}! Azi, {{2}}, aveți {{3}}: {{4}}. Vă dorim o zi frumoasă!”, apoi
scrieți numele lui în Setări → Mesaje → Mesaje către echipă → „Programul zilei”. Până la aprobare
(de obicei câteva minute–ore), programul pleacă prin SMS. Mesajul pleacă la ora aleasă doar dacă
**Cron Job-ul** rulează (vezi mai jos).

## Chatul AI de pe site și programările online (etapa 5)

Pe site apare butonul **Întrebați-ne**: un asistent AI răspunde oricând la întrebări despre
clinici, servicii, prețuri și medici (doar din datele din panou) și **programează** pe orele libere.

**1. Programul medicilor:** Echipa → medic → **Unde și când lucrează**: pentru fiecare clinică, orele
pe zile (de exemplu Luni–Vineri 09:00–17:00). Din program, din programările existente și din
sărbătorile legale (inclusiv Paștele și Rusaliile ortodoxe) se calculează orele libere. Un medic fără
program nu primește programări online.

**2. Pornirea:** Setări → **Chatul de pe site** (cheia API Anthropic trebuie salvată înainte în
Setări → Asistentul AI). Alegeți:
- **Cerere** (implicit): pacientul alege ora, iar recepția îl sună să o confirme; cererea apare la
  Cereri online, cu ora aleasă.
- **Direct în calendar**: pacientul primește un cod prin SMS, îl scrie în chat, iar programarea intră
  în calendar și pacientul primește confirmarea. Cere SMS-urile pornite (SMSLink, mod „Trimitere
  reală”).

Mai setați o limită zilnică de conversații (cost) și după câte zile se șterg. Durata, cât de
devreme și cu câte zile înainte se pot face programările se aleg la Setări → **Programări online**
(aceleași pentru site și chat).

**3. Urmărirea:** meniul **Chat pe site** arată conversațiile, ce s-a întâmplat (doar întrebări,
cerere, programare) și consumul. La „Programare făcută online” din Contul meu → Notificările mele,
recepția poate primi SMS/e-mail.

**Siguranță:** asistentul nu vede fișele pacienților; programează doar pe ore libere reale, verificate
din nou în momentul programării; limitează cererile (pe conexiune și pe zi); nu pune diagnostice și
trimite urgențele la telefon sau 112. Ce scrie vizitatorul ajunge la Anthropic: menționați în
Politica de confidențialitate.

## Programarea online pe site, absențe și zile libere (etapa 6a)

Pe pagina **Programare**, pacientul își alege singur ora, în 4 pași: motivul și clinica → ziua și
ora (orice medic sau unul anume) → cum se simte (fără emoții, emoții, frică) → numele și telefonul.
Programarea intră direct în calendar, cu sursa „online”, iar pacientul primește confirmarea (SMS și
e-mail) cu un **link** de unde o confirmă, o anulează (până cu N ore înainte) sau o adaugă în
calendarul telefonului. Dacă recepția mută sau anulează programarea, linkul vechi nu mai merge. Cine
nu găsește o oră apasă „Prefer să mă sunați” și lasă o cerere.

- **Setări → Programări online**: pornit/oprit (oprit = formularul vechi de cerere), din câte în câte
  minute se arată orele, cel mai devreme față de acum, câte zile înainte, pauza dintre programări,
  durata implicită, până când poate anula pacientul, unde se termină dimineața.
- **Servicii și prețuri → serviciu**: fiecare rând are **Durează** (cât ține) și **Programare online**
  (apare ca motiv pe site, cu textul și explicația lui; „Urgență” îl pune al doilea, evidențiat).
- **Echipa → medic**: programul pe zile poate avea o **pauză** (de exemplu 13:00–14:00), iar
  „Primește programări de pe site” scoate medicul din programarea online.
- **Absențe și zile libere** (meniu): concediu, curs, interval blocat pentru un medic (la o clinică
  sau la toate), sau **clinica închisă** o zi sau o perioadă. Orele dispar imediat de pe site și din
  chat, apar hașurate în calendar, iar programările deja făcute în acel interval sunt arătate ca să fie
  mutate. Medicul își poate pune singur absențele. Sărbătorile legale sunt știute automat.
- În panou, o programare peste o absență nu se poate face; în afara programului, în pauză, într-o
  sărbătoare sau peste altă programare a pacientului apare un avertisment („Programez oricum”).
- Un telefon folosit de mai mulți din familie: fișa se refolosește doar dacă se potrivește și numele;
  altfel se face fișă nouă. Programarea pentru un copil face fișa copilului, cu părintele trecut.

## Contul VITIM (suport tehnic) și partea financiară

Panoul are cinci roluri: **Suport tehnic (VITIM)**, Administrator, **Administrator medic**, Recepție, Medic.

- **VITIM** configurează: Setări (firma, clinicile, mesaje SMS/WhatsApp/e-mail, asistentul AI,
  chatul, programările online, tabletele, actualizările) și Utilizatori. Vede și tot restul.
- **Administratorul** vede tot ce ține de clinică (pacienți, calendar, rapoarte, prețuri, echipa,
  fotografii, marketing, GDPR, jurnal), dar nu mai vede Setări și Utilizatori cât timp există un cont
  VITIM activ. Fără cont VITIM, administratorul le are pe toate (ca la instalare).
- **Administratorul medic** este administratorul care e și medic: are tot ce are administratorul,
  plus partea de medic (anamneză, odontogramă, planuri, note, implanturi, consultația cu AI). Contul se
  leagă obligatoriu de profilul lui de medic (Utilizatori → cont → Profilul de medic), ca programările
  și notificările lui să ajungă la el.
- Ca să treceți contul existent pe rolul nou: Utilizatori → contul VITIM → Rolul: **Suport tehnic
  (VITIM)** → Salvați. Din acel moment, Setările și Utilizatorii le vede doar VITIM.
- **Ce a schimbat VITIM ajunge la administrator**: pe pagina **Azi** apare un chenar cu fiecare
  modificare (ce valoare era și ce a devenit), până apasă „Am văzut”; după 10 minute fără alte
  modificări, administratorul primește și un e-mail cu rezumatul (unul pe sesiune de lucru, nu unul pe
  fiecare clic). Totul rămâne și în Jurnal.

**Partea financiară** (facturi, încasări, sold pacient, venituri în rapoarte) este **oprită** până la
etapa 2, după perioada de probă. O pornește VITIM din Setări → Module → „Partea financiară”. Oprită,
nimeni din clinică nu vede Facturi, Încasări, fila „Facturi și plăți” din fișă sau veniturile din
Rapoarte; ce s-a emis deja rămâne în baza de date.

## Calendar, cereri și pacienți (etapa 6b)

**Calendarul**
- În vederea pe zi, o programare se **trage** la altă oră, la alt medic sau în alt cabinet și se
  **lungește** de marginea de jos. Câteva secunde apare „Anulați”. Pacientul primește noua oră abia
  după două minute, deci o mutare anulată nu trimite nimic. Peste o absență nu se poate muta; în
  afara programului sau peste altă programare, calendarul întreabă
  „Mutați oricum?”.
- Vederi: **Zi** (pe medici sau pe cabinete), **Săptămână**, **Listă** (șapte zile, cu telefonul și
  starea). O linie roșie arată ora de acum.
- Starea se schimbă dintr-un clic pe pagina programării, cu revenire (de exemplu anulat → programat,
  o vizită redeschisă). La **Finalizat**, pacientul intră singur pe lista de rechemări (la 6 luni,
  3 la parodontologie, 1 la ortodonție), dacă nu are deja o rechemare sau o programare viitoare.
- Setări (VITIM) → clinica: **orele clinicii pe zile** (taie programul medicilor pe site),
  **câte cabinete** are și **firma clinicii**. La Echipa → medic: cabinetul obișnuit.

**Cererile**
- Pe fiecare cerere: **cine se ocupă**, **istoricul** (apel cu rezultat: a răspuns, nu răspunde,
  ocupat, sună el; SMS, e-mail, notă), starea și, la închidere fără programare, **motivul** (preț,
  distanță, altă clinică…). Primul apel trece cererea „În lucru” și o dă celui care a sunat.
- „Poate este deja pacient”: fișele cu același telefon, e-mail sau nume, cu „Programare pe această
  fișă”, ca să nu apară fișe duble.
- Cereri → **Tablou**: câte o coloană pe stare, cu butoane de mutare; filtrul „Se ocupă: Eu”.
- Rapoarte → „De ce nu s-au programat”.

**Pacienții**
- La fișă nouă, dacă există cineva cu același telefon, CNP, e-mail sau nume și dată a nașterii,
  apare lista și trebuie bifat „Este altă persoană”.
- **Etichete** pe fișă (de exemplu VIP) și filtru după etichetă în lista de pacienți.
- **Note** fixate sus, modificate sau șterse de autor (sau de administrator).
- CNP-ul se vede mascat; „Arătați CNP-ul întreg” îl arată două minute și se trece în Jurnal.
- **Tutorele** poate fi o fișă (nr. fișei); pe fișa tutorelui apar „În grija sa”. Programarea pentru
  un copil de pe site leagă singură fișa părintelui, dacă există.
- **Implanturi**: pe fișă, etapele fiecărui caz (plan, inserat, descoperit, amprentă, lucrarea
  finală, control anual) cu data pasului următor; meniul **Implanturi** arată toate cazurile în
  curs, cele întârziate marcate.

**Altele**
- Contul meu: **tema panoului** (luminos, întunecat, ca sistemul) și „Ieșiți de pe celelalte
  dispozitive”. La Utilizatori (VITIM): „Închideți toate sesiunile contului”.
- Prima pagină a site-ului arată **prima oră liberă** la fiecare clinică.

## Reamintiri pe e-mail (Cron Jobs)

Pacienții primesc reamintirea în ziua dinaintea programării (între orele 10 și 21), pe SMS/WhatsApp
și/sau e-mail, dacă programarea a fost făcută cu cel puțin 18 ore înainte. Tot din Cron Jobs pleacă
mesajele din coadă, agenda de dimineață a medicilor, mulțumirile, felicitările și rechemările.
Merg și singure, când cineva lucrează în panou, dar ca să plece sigur la timp:

1. cPanel → **Cron Jobs** → **Add New Cron Job**;
2. **Common Settings**: **Once Per Five Minutes** (`*/5 * * * *`);
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

**Din panou (recomandat):** Setări → **Actualizare**.
1. Faceți o copie a bazei de date (cPanel → **Backup**).
2. Alegeți arhiva `dentalarena-php.zip` primită și apăsați **Încărcați și verificați**. Arhiva se
   trimite pe bucăți de 1 MB, deci limita de încărcare a găzduirii nu contează.
3. Panoul arată versiunea de acum și pe cea nouă. Scrieți parola și apăsați **Instalați
   actualizarea** (durează de obicei sub un minut; între timp site-ul afișează „Actualizăm
   site-ul”, panoul merge în continuare).
4. Dacă ceva nu e în regulă: **Copii de siguranță → Puneți înapoi** versiunea de dinainte.

Nu se ating: `dentalarena/config.php`, `dentalarena/storage` (documente, sesiuni, jurnale),
`public_html/media` (fotografiile încărcate din panou) și baza de date (tabelele noi se adaugă
singure). Liniile pe care cPanel le scrie în `.htaccess` (versiunea de PHP) se păstrează. Se
acceptă doar arhive cu structura pachetului (folderele `public_html` și `dentalarena`).

**Prima dată** (sau dacă panoul nu se mai deschide): încărcați `dentalarena-php.zip` în același loc
ca la instalare, în cPanel → File Manager, și dați **Extract** cu suprascriere.

## Copii de siguranță

cPanel → **Backup**: descărcați regulat **MySQL Database** (baza site-ului) și **Home Directory**.
Copia **Home Directory** cuprinde și documentele pacienților (`dentalarena/storage/documente`).
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

## Două firme, fără inhalosedare, Administrator medic, Facebook (octombrie 2026)

- **Fiecare clinică este o firmă**: Cristești = S.C. Dental Arena S.R.L. (CUI RO30570968), Luduș =
  S.C. Dental Arena Ludus S.R.L. (CUI RO30611278). Datele firmei se completează în Setări → clinica →
  **Firma clinicii** (denumire, CUI, Reg. Com., sediu, bancă, IBAN). Firma apare pe acordurile semnate
  la acea clinică (pe tabletă: firma clinicii tabletei; tipărit: firma clinicii alese), la sfârșitul
  fiecărui acord, pe facturi, în subsolul site-ului și în Politica de confidențialitate / Termeni
  (ambele firme, fiecare cu clinica ei). Cu partea financiară pornită, fiecare clinică are **seria ei**
  de facturi și de chitanțe (Cristești DA/DAC, Luduș DAL/DALC), numerotate separat.
- **Inhalosedarea nu se mai practică**: a dispărut de pe site (pagina, prețul, întrebările, bifa de la
  programare) și din panou (programare, calendar, fișă, setări, acorduri). Adresa veche
  `/inhalosedare` duce la `/servicii`. Acordurile de inhalosedare semnate înainte rămân în fișă, ca
  istoric, și se pot deschide; nu se mai pot cere.
- **Administrator medic**: rol nou (vezi mai sus).
- **Fotografiile clinicilor** au fost inversate: casa albă cu coloana din lemn este Cristești, fațada
  cu vitrina este Luduș.
- **Postările de pe Facebook** apar pe prima pagină, în „Ce mai facem” (pluginul de pagină Facebook).
  Se încarcă doar după acordul vizitatorului (butonul „Afișați postările” sau cookie-urile Facebook
  din banner), ca harta Google. Adresa paginii și afișarea se schimbă din Setări → **Pagina de
  Facebook**; pagina trebuie să fie publică.
- Actualizarea aplică singură migrarea `011_two_companies.sql`.

## Pacienții din QDental, program până la 21:00, ordinea medicilor, culorile calendarului (octombrie 2026)

- **Pacienții din programul vechi (QDental)**: actualizarea aduce lista lor (nume, prenume, telefon,
  plus numărul fișei vechi într-o notă) în `dentalarena/data/import/`. Se adaugă **o singură dată**,
  la prima pagină de panou deschisă după actualizare (câteva secunde); rezultatul apare în Jurnal
  („import-pacienti”). Un pacient care există deja (același telefon și același nume) nu se dublează.
  Fișa veche se găsește și după număr: căutați „4416”. Lista nu intră în GitHub (date personale).
- **Ora maximă: 21:00**. Calendarul arată ziua de la 9:00 la 21:00 pe un singur ecran, iar în
  formularul de programare orele merg până la 21:00. Pe site se văd ore până la 21:00 doar dacă
  programul medicului (Echipa → medic → „Unde și când lucrează”) și orele clinicii (Setări) merg
  până la 21:00.
- **Ordinea medicilor**: Echipa → săgețile ↑ ↓. Aceeași ordine pe site, în calendar și la programare.
- **Culorile programărilor**: albă = programat, portocalie = confirmat, verde = a sosit (mai închis:
  în tratament), roșie = nu a venit, gri = finalizat / anulat. Un clic pe programare deschide meniul
  rapid (Confirmat, A sosit, Nu a venit, Deschideți).

## Servicii: Odontologie și Endodonție, fără Estetică, servicii noi din panou (octombrie 2026)

- „Stomatologie generală” s-a împărțit în **Odontologie** (carii, obturații, reconstrucții) și
  **Endodonție** (pansament calmant, tratament de canal, retratament). Adresa veche
  `/stomatologie-generala` duce la `/odontologie`. Medicii bifați la stomatologie generală sunt bifați
  la amândouă.
- **Estetica dentară** a fost scoasă (pagina, prețurile); `/estetica-dentara` duce la `/servicii`.
  Prețurile folosite deja în planuri sau facturi rămân ascunse, în istoric.
- **Servicii și prețuri** (administratori): serviciu nou (o pagină nouă pe site), ordinea cu săgeți,
  numele și textele paginii, „apare pe site”, ștergere; prețurile (sub-serviciile) ca înainte.
  Un serviciu nou primește și loc de fotografie la Fotografii site.
- **Calendarul**: programările care se suprapun la același medic stau una lângă alta; cele de până
  la 30 de minute se arată pe un rând (ora și numele).
- Actualizarea aplică singură migrarea `012_service_pages.sql`.

## Proceduri și plăți (octombrie 2026)

- Fișa pacientului are fila **Proceduri și plăți** (ca în QDental): procedurile efectuate (data,
  dintele, procedura, medicul, de plată, achitat, rămas) și plățile, cu totalurile: total de plată,
  achitat, rămas de plată, avans. Medicul adaugă procedurile (din lista de prețuri, prețul se
  completează singur; mai mulți dinți = câte un rând pe dinte), recepția înregistrează plățile; o
  plată se trece pe procedurile neachitate de la cea mai veche, surplusul rămâne avans.
- Din programarea pacientului sosit (și din meniul ei din calendar): **Proceduri efectuate**.
- Meniul **Proceduri**: procedurile unei perioade, pe medic și clinică, doar neachitate, cu totaluri.
- Separat de facturi (partea financiară a etapei 2 rămâne oprită).
- **Importul din QDental**: procedurile din 01.01–16.10.2026 (3.556, cu 3.668 plăți; total
  1.412.851,19 lei, achitat 1.337.967,39 lei) se adaugă o singură dată, la prima pagină de panou după
  actualizare, la pacienții cu fișa QDental respectivă. 7 rânduri fără pacient real („Liber”,
  „Pacient X”) nu se iau. Trei nume cu două fișe diferite în QDental (Moldovan Vasile, Ghiurca
  Stefan, Stoica Ramona) merg pe fișa mai nouă, cu nota „De verificat”.
- Actualizarea aplică singură migrările `013_procedures.sql` și `014_procedures_notes.sql` (scoate nota
  „De verificat” de la pacienții cu două fișe QDental care aici sunt un singur pacient).

## Sterilizare și importuri sigure (octombrie 2026)

- Fișa pacientului are fila **Sterilizare**: butonul **Încarcă poză** (pe telefon deschide camera; se
  pot alege mai multe poze), cu o notă opțională (lotul, autoclavul). Pozele se păstrează ca
  documentele pacientului (în `storage/documente`, în afara public_html), dar nu apar la
  „Documente și acorduri”. Le șterge administratorul.
- Importurile din `data/import` se fac mult mai repede (câte 500 de rânduri odată) și se reiau
  singure dacă serverul le-a oprit la jumătate (lacătul rămas se ignoră după 10 minute). Cele care
  n-au reușit se încearcă din nou imediat după o actualizare, sau imediat ce s-a adăugat lista de
  care depindeau (procedurile după pacienți).
- **Setări → Actualizare → Date aduse din QDental** arată fiecare listă: adăugată (cu câte), în curs,
  în așteptare sau motivul pentru care n-a reușit, cu butonul **Adăugați acum**.

## Sunat, nu răspunde (octombrie 2026)

- Bifa **Sunat, nu răspunde** apare la programările încă neconfirmate: în meniul de la clic din
  calendar, în lista de pe **Azi** și pe pagina programării. Bifată, programarea clipește în roșu
  (cu ora apelului) în calendar și pe **Azi**, până când pacientul confirmă, ajunge sau se scoate
  bifa. Cu „mișcare redusă” din sistem rămâne doar conturul roșu, fix.
- Actualizarea aplică singură migrarea `015_appointment_no_answer.sql`.

## Sterilizare: poze de pe telefon cu cod QR (octombrie 2026)

- În fila **Sterilizare**, **Cod QR pentru telefon** arată un cod QR (desenat de server, biblioteca
  `bacon/bacon-qr-code` din `vendor/`, cere extensia PHP `iconv`, prezentă pe cPanel). Telefonul
  care îl scanează deschide `/incarca/<cod>`: **Faceți o poză** (camera) sau **Alegeți din
  galerie**, fără parolă. Pozele se micșorează pe telefon (cel mult 2000 px) și se trimit pe rând,
  deci limita de încărcare a găzduirii nu contează. Pagina de pe calculator le arată singură.
- Codul: o oră, un pacient, doar adăugare de poze, cel mult 40; **Opriți codul** îl închide. În baza
  de date se păstrează doar amprenta lui (SHA-256). Pe telefon se vede doar „Nume I.” și fișa.
- Actualizarea aplică singură migrarea `016_upload_links.sql`.

## Odontogramă la proceduri, orice fișier în fișă (octombrie 2026)

- **Adaugă procedură** are odontograma pacientului (cu ce e notat pe ea, pentru medici): clic pe un
  dinte îl adaugă la „Dintele (dinții)”, încă un clic îl scoate; fiecare dinte devine un rând.
- Prima pagină a fișei are secțiunea **Fișiere**: **Încărcați fișiere** (mai multe deodată) și **Cod QR
  pentru telefon** (la „Documente și acorduri”, ca la Sterilizare, dar pentru orice fișier).
- Se primesc: poze (JPG, PNG, WebP, HEIC, GIF, TIFF), PDF, Word, Excel, ODT, text, video (MP4, MOV,
  WebM), ZIP, DICOM, scanări 3D (STL, PLY, OBJ, 3MF), cel mult 100 MB (sau limita găzduirii). Ce nu
  poate arăta browserul (Word, STL…) se descarcă. Un fișier prea mare pentru server dă acum un mesaj
  clar în loc de „Formularul a expirat”.

## Consimțăminte noi pe tabletă (octombrie 2026)

- Trei formulare ale clinicii, de semnat pe tabletă sau tipărit: **tratamentul endodontic (de canal)**,
  **tratamente chirurgicale** (formularul CMDR, fără sigla lui) și **tratamentul pe implanturi** (un
  singur formular pentru toți medicii; numele medicului se completează).
- La „Dați un cod pentru tabletă” se aleg **Medicul** și **Intervenția / dinții**; intră în text
  (`{{medic}}`, `{{interventie}}`), iar la chirurgie și adresa și telefonul pacientului (`{{adresa}}`,
  `{{telefon}}`). Pe hârtie rămân linii de completat. Textele se pot schimba din Setări → Textele
  acordurilor. Seria și numărul buletinului din formularul de chirurgie nu se cer (panoul nu le ține).
- Actualizarea aplică singură migrarea `017_consent_details.sql`.

## Tableta în engleză și chestionarul clinicii (octombrie 2026)

- La codul pentru tabletă se alege **Limba pe tabletă: Română / English**. În engleză: ecranele
  tabletei, toate acordurile (GDPR, tratament, fotografii, endodonție (textul clinicii), chirurgie,
  implanturi), chestionarul și declarația; pentru pacient nou, indicațiile clinicii („Because you are a
  new patient…”). Acordul semnat se păstrează în limba în care a fost semnat; ecranul codului e bilingv.
- Textele în engleză se pot schimba din Setări → Textele acordurilor → „Textele în engleză”.
  Traducerile pentru GDPR, tratament, fotografii, chirurgie și implanturi sunt făcute de noi: de
  verificat de clinică.
- Chestionarul de pe tabletă (română și engleză) urmează „Fișa de tratament / Chestionar de sănătate”
  a clinicii: pe lângă afecțiunile din anamneză, internări, accidente/operații, gingii care sângerează,
  sângerare după extracții, bruxism, boli infecțioase, reumatism, boli respiratorii, de rinichi,
  probleme psihice, plus profesia, medicul de familie, țigări pe zi, luna sarcinii și declarația despre
  tratamente și tarife. Răspunsurile intră la „Alte afecțiuni” când medicul aplică chestionarul.
- Formularele tipărite au și varianta în engleză (butonul „EN” de lângă „Formularul”).
- Actualizarea aplică singură migrarea `018_tablet_language.sql`.

## E-mail: verificare, probă și cont SMTP din panou (octombrie 2026)

- **Setări → Mesaje → E-mail: verificare și probă** arată ce oprește e-mailurile (copie de test,
  „Mod de probă”, funcția mail() oprită pe server), cum pleacă (mail() sau contul SMTP), expeditorul,
  e-mailurile din ultimele 7 zile și ultimele erori. **Trimiteți proba** trimite pe loc și spune
  dacă a plecat sau de ce nu (de ex. „SMTP: 535 … credentials invalid” = parolă greșită).
- **E-mail: contul de trimitere (SMTP)**: serverul, portul (465 SSL / 587 STARTTLS), contul, parola
  (păstrată criptat) și expeditorul, direct din panou (are prioritate față de `'smtp'` din
  config.php). Date din cPanel → Email Accounts → Connect Devices.
- Erorile e-mailurilor din coadă se văd acum cu motivul exact în Jurnalul mesajelor.
- Dacă proba pleacă dar nu ajunge: cPanel → Email Deliverability → „Repair” la SPF și DKIM.
