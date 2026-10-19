/**
 * The text of the four user manuals (reception, doctors, administrator, VITIM technical support). Each chapter is a
 * function returning HTML; the manuals pick and order them. Helpers: pasi() numbered steps,
 * img() a screenshot from .capturi, sfat()/atentie() boxes, tabel() a simple table.
 */

export const img = (name, caption = "", o = {}) =>
  `<figure class="${o.mic ? "mic" : ""}${o.lat ? " lat" : ""}"><img src="${name}.jpg" alt="">${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
export const pasi = (items) => `<ol class="pasi">${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;
export const sfat = (t) => `<aside class="sfat"><strong>Bine de știut.</strong> ${t}</aside>`;
export const atentie = (t) => `<aside class="atentie"><strong>Atenție.</strong> ${t}</aside>`;
export const tabel = (head, rows) =>
  `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const b = (t) => `<b class="ui">${t}</b>`; // a label exactly as on screen

// ── Common ───────────────────────────────────────────────────────────────────────────────

export const despre = (rol) => ({
  titlu: "Despre acest manual",
  html: `
<p>Panoul Dental Arena este programul în care clinica lucrează zilnic: calendarul și programările, fișele pacienților, acordurile, mesajele către pacienți și cererile venite de pe site (inclusiv programările făcute de pacienți direct pe site). Se deschide în browser (Chrome, Edge, Safari sau Firefox), pe calculator, tabletă sau telefon, la adresa:</p>
<p class="adresa">https://dentalarena.ro/admin</p>
<p>Acest manual este pentru <strong>${rol}</strong>. Fiecare capitol descrie un ecran: la ce folosește, pașii obișnuiți și ce e bine de știut. Imaginile sunt din panou, cu date de probă.</p>
${tabel(["Rolul", "Ce vede și ce face"], [
  ["Recepție", "Calendarul și programările, pacienții (fără anamneza completă), cererile de pe site, rechemările, absențele, documentele și acordurile, mesajele."],
  ["Medic", "Programările, fișa completă (anamneză, note clinice), odontograma, planurile de tratament, implanturile, consultația cu AI, absențele proprii."],
  ["Administrator", "Tot ce ține de clinică: ce văd recepția și medicii, plus rapoartele, prețurile, echipa, fotografiile site-ului, marketingul, GDPR și jurnalul."],
  ["Administrator medic", "Administratorul care este și medic: tot ce are administratorul, plus partea de medic (consultații, intervenții, fișa completă), legat de profilul lui de medic."],
  ["Suport tehnic (VITIM)", "Configurarea: setările (firma, clinicile, mesajele, AI, chatul, programările online, tabletele, actualizările) și conturile. Administratorul primește un rezumat cu tot ce schimbă VITIM."],
])}
${sfat("Recepția și medicii văd doar clinicile bifate în contul lor (Cristești, Luduș sau amândouă). Administratorii și VITIM le văd pe amândouă.")}
${sfat("Fiecare clinică este o firmă separată: Cristești este S.C. Dental Arena S.R.L. (CUI RO30570968), Luduș este S.C. Dental Arena Ludus S.R.L. (CUI RO30611278). Acordurile, documentele tipărite și facturile poartă firma clinicii unde se fac.")}
${sfat("Partea financiară (facturi, încasări, soldul pacientului) e oprită în această perioadă de probă și se pornește în etapa a doua. Manualul ei vine atunci.")}`,
});

export const intrare = () => ({
  titlu: "Intrarea în panou și contul dumneavoastră",
  html: `
${img("intrare", "Ecranul de intrare.", { mic: true })}
<h3>Intrarea</h3>
${pasi([
  `Deschideți <span class="adresa-inline">dentalarena.ro/admin</span>.`,
  `Scrieți adresa de e-mail și parola primite de la administrator, apoi apăsați ${b("Intrați")}.`,
  `La prima intrare, panoul vă duce la ${b("Contul meu")}: alegeți o parolă a dumneavoastră (cel puțin 10 caractere). De acum intrați cu ea.`,
])}
${sfat("După 10 încercări greșite în 15 minute, intrarea se blochează pentru un sfert de oră. Dacă ați uitat parola, suportul tehnic (VITIM) vă pune una nouă de început.")}
<h3>Ieșirea</h3>
<p>Butonul ${b("Ieșire")} e jos, în meniul din stânga (pe telefon: în meniul de sus). Pe un calculator folosit de mai multe persoane, ieșiți de fiecare dată când plecați.</p>
<h3>Contul meu</h3>
<p>Din linkul ${b("Contul meu")} (sub numele dumneavoastră, în meniu):</p>
<ul>
<li><strong>Schimbați parola</strong>: parola de acum, apoi cea nouă de două ori.</li>
<li><strong>Notificările mele</strong>: telefonul dumneavoastră și, pentru fiecare situație (programare nouă, programare făcută online, cerere nouă de pe site, mesaj WhatsApp de la un pacient etc.), unde vreți să fiți anunțat: SMS, WhatsApp sau e-mail.</li>
<li><strong>Aspectul panoului</strong>: ${b("Luminos")}, ${b("Întunecat")} (mai odihnitor seara) sau ${b("Ca sistemul (zi / noapte)")}.</li>
<li><strong>Dispozitivele mele</strong>: ${b("Ieșiți de pe celelalte dispozitive")} închide contul pe orice alt calculator sau telefon (de exemplu unul pierdut). Pe cel de acum rămâneți în cont.</li>
</ul>
${img("cont", "Contul meu: parola, notificările, aspectul și dispozitivele.")}`,
});

export const ecranul = () => ({
  titlu: "Cum arată panoul",
  html: `
<p>În stânga e <strong>meniul</strong>; în dreapta, pagina deschisă. Pe telefon, meniul se deschide din butonul din colțul de sus.</p>
${img("azi", "Pagina Azi: meniul în stânga, alegerea clinicii sus, programările zilei.")}
<ul>
<li><strong>Alegerea clinicii</strong> (${b("Cristești")} / ${b("Luduș")}): pe paginile Azi, Calendar și Rechemări arătați clinica la care lucrați. Panoul o ține minte.</li>
<li><strong>Etichetele colorate</strong> de lângă numele unui pacient (de exemplu „VIP”) sunt puse de echipă, ca să-l recunoașteți ușor.</li>
<li><strong>Bulina galbenă</strong> de lângă ${b("Cereri online")} arată câte cereri noi au venit de pe site.</li>
<li><strong>Mesajele de confirmare</strong> apar sus, pe verde (s-a salvat) sau pe roșu (ce trebuie corectat). La un formular cu greșeli, lista de sus duce direct la câmpul de corectat.</li>
<li><strong>Alertele medicale</strong> apar ca etichete roșii lângă numele pacientului (alergii, anticoagulante, diabet etc.). Eticheta galbenă înseamnă un pacient cu emoții sau căruia îi e frică.</li>
</ul>
${sfat("Nimic nu se șterge din greșeală: înainte de ștergeri și anulări, panoul cere confirmare.")}`,
});

// ── Day to day: Azi, calendar, appointments ─────────────────────────────────────────────

export const azi = (rol) => ({
  titlu: "Azi: ziua la clinică",
  html: `
<p>Pagina ${b("Azi")} se deschide prima. Arată programările zilei în ordine, cu alertele fiecărui pacient și cu <strong>pasul următor</strong> ca buton.</p>
${img(rol === "medic" ? "azi-medic" : "azi-receptie", "Programările zilei, cu butonul pentru pasul următor.")}
${tabel(["Starea", "Ce înseamnă", "Butonul care urmează"], [
  ["Programat", "Programarea e făcută.", `${b("Confirmat")} (pacientul a confirmat la telefon) sau ${b("A sosit")}`],
  ["Confirmat", "Pacientul a confirmat.", b("A sosit")],
  ["A sosit", "Pacientul e în sala de așteptare.", b("Începe tratamentul")],
  ["În tratament", "Pacientul e la medic.", b("Finalizat")],
  ["Finalizat", "Vizita s-a încheiat.", "—"],
  ["Nu s-a prezentat", `Apăsați ${b("Nu a venit")} dacă pacientul lipsește.`, "—"],
])}
<p>Butonul ${b("⋯")} deschide programarea (pentru mutare, anulare sau rechemare). În dreapta: <strong>Cererile online noi</strong> și câți pacienți sunt de sunat pentru control.</p>
<p>La ${b("Finalizat")}, pacientul intră singur pe lista de rechemări pentru control (de obicei peste 6 luni; 3 luni la parodontologie, o lună la ortodonție), dacă nu are deja o rechemare sau o programare viitoare.</p>
${rol === "admin" ? `<p>Ca administrator, sus pe pagina Azi vedeți și ce a schimbat <strong>suportul tehnic (VITIM)</strong> în setări, până apăsați ${b("Am văzut")} (vezi capitolul despre VITIM).</p>` : ""}
${rol === "medic" ? sfat("Când recepția apasă „A sosit”, medicul care a cerut această notificare în Contul meu primește un mesaj.") : sfat("Când apăsați „A sosit”, medicul poate fi anunțat automat pe telefon (dacă a cerut asta în Contul meu).")}`,
});

export const calendar = () => ({
  titlu: "Calendarul",
  html: `
<p>Calendarul arată ziua unei clinici, cu câte o coloană pentru fiecare medic, de la 9:00 la 21:00, pe sferturi de oră, toată pe un singur ecran (fără derulare, pe calculator și pe tabletă). Dacă o programare sau programul clinicii iese din interval, ziua se lărgește singură. Sus alegeți clinica și vederea: ${b("Zi")}, ${b("Săptămână")} sau ${b("Listă")}.</p>
${img("calendar-zi", "Calendarul pe o zi: orele în care medicul nu lucrează sunt gri, pauza e notată, absențele sunt roșii, iar sus apare lista absențelor zilei.")}
<ul>
<li>${b("‹")} ${b("Azi")} ${b("›")} mută ziua; câmpul de dată sare la orice zi.</li>
<li>Un <strong>clic pe un loc liber</strong> deschide o programare nouă cu medicul, ziua și ora deja completate.</li>
<li>Un <strong>clic pe o programare</strong> deschide un meniu mic: ${b("Confirmat")}, ${b("A sosit")}, ${b("Nu a venit")} (și pașii următori: începe tratamentul, finalizat) sau ${b("Deschideți programarea")}. Starea se schimbă pe loc, fără să plecați din calendar.</li>
<li>${b("Sunat, nu răspunde")}: bifați-o în același meniu când ați sunat pacientul și nu a răspuns. Programarea <strong>clipește în roșu</strong> în calendar și pe pagina ${b("Azi")}, cu ora la care ați sunat, până când pacientul confirmă (sau ajunge) ori până scoateți bifa. Aceeași bifă e și pe pagina programării și în lista de pe ${b("Azi")}.</li>
<li><strong>Culorile căsuțelor</strong>: albă cu chenar punctat = programat (neconfirmat), <strong>portocalie</strong> = a confirmat, <strong>verde</strong> = a sosit (verde mai închis: în tratament), <strong>roșie</strong> = nu a venit, gri = finalizat sau anulat. Legenda culorilor e lângă titlu sau sub calendar.</li>
<li><strong>Gri</strong>: orele în care medicul nu lucrează la clinica asta, pauza lui sau orele în care clinica e închisă. <strong>Roșu</strong>: concediu, curs sau interval blocat (vezi capitolul despre absențe). Sus, banda galbenă arată absențele și sărbătorile legale din ziua sau săptămâna aleasă.</li>
<li>Azi, o <strong>linie roșie</strong> arată ora de acum.</li>
<li>Programările finalizate apar mai șterse; punctul galben arată un pacient cu emoții sau căruia îi e frică.</li>
</ul>
<h3>Mutarea prin tragere</h3>
${pasi([
  "Apăsați pe programare și, ținând apăsat, trageți-o la altă oră sau în coloana altui medic.",
  "Ca să schimbați durata, trageți de marginea de jos a programării.",
  `Jos apare „Programarea a fost mutată” cu butonul ${b("Anulați")}, câteva secunde. Dacă ați greșit, apăsați-l: programarea revine la locul ei.`,
])}
${img("calendar-mutare", "O programare mutată prin tragere, cu „Anulați” jos.")}
${sfat("Pacientul primește noua oră abia după două minute, ca o mutare anulată imediat să nu-i trimită nimic. Peste concediul sau cursul medicului nu se poate muta; în afara programului, în pauză sau peste altă programare, panoul întreabă „Mutați oricum?”.")}
<h3>Pe cabinete, listă, săptămână</h3>
<p>La o clinică cu mai multe cabinete, ${b("Pe cabinete")} arată câte o coloană pe cabinet; o programare trasă în alt cabinet se mută acolo. ${b("Listă")} arată șapte zile la rând, cu ora, pacientul și telefonul, medicul, motivul și starea (bun de tipărit pentru ziua următoare). ${b("Săptămână")} arată pe scurt programările fiecărei zile.</p>
${img("calendar-cabinete", "Calendarul pe cabinete.")}
${img("calendar-lista", "Vederea Listă.")}
${img("calendar-saptamana", "Vederea pe săptămână.")}`,
});

export const programari = () => ({
  titlu: "Programările: nouă, mutare, stare, anulare",
  html: `
<h3>O programare nouă</h3>
<p>Din ${b("Programare nouă")} (pe Azi, în Calendar sau în fișa pacientului), dintr-un clic pe un loc liber în calendar, sau din ${b("Faceți programarea")} într-o cerere de pe site.</p>
${pasi([
  `<strong>Pacientul</strong>: căutați-l după nume, telefonul sau numărul fișei. Dacă e nou, completați numele, prenumele și telefonul în chenarul ${b("Pacient nou")}. Dacă există deja un pacient cu același telefon <em>și același prenume</em>, programarea se pune pe fișa lui; altfel se face o fișă nouă (într-o familie, toți pot avea același telefon).`,
  `<strong>Când și la cine</strong>: clinica, medicul, ziua, ora, durata și, la o clinică cu mai multe cabinete, cabinetul (gol = cabinetul obișnuit al medicului).`,
  `<strong>Pentru ce</strong>: serviciul, motivul (de exemplu „durere la 36”), și cum se simte pacientul.`,
  `Apăsați ${b("Faceți programarea")}.`,
])}
${img("programare-noua", "Formularul de programare nouă.")}
<h3>Când ora are o problemă</h3>
<p>Înainte de salvare, panoul verifică ora aleasă:</p>
${tabel(["Situația", "Ce face panoul"], [
  ["Medicul e în concediu, la curs, sau clinica e închisă", "Nu salvează. Alegeți altă oră sau ștergeți întâi absența."],
  ["Medicul are deja o programare atunci", "Avertizează."],
  ["Pacientul are deja o programare atunci (la alt medic)", "Avertizează."],
  ["În afara programului medicului sau al clinicii, în pauză, într-o sărbătoare legală", "Avertizează."],
  ["Cabinetul e ocupat", "Avertizează."],
  ["Ora e în trecut", "Avertizează."],
])}
<p>La un avertisment, verificați lista și fie alegeți altă oră, fie bifați ${b("Programez oricum (de exemplu, o urgență)")} și salvați din nou.</p>
${img("programare-avertisment", "Ora aleasă e în pauza medicului: „Programez oricum”.")}
${sfat("Pacientul primește automat confirmarea pe SMS, WhatsApp sau e-mail (cum a ales), cu un link de unde poate confirma, anula sau pune programarea în calendarul telefonului, și o reamintire în ziua de dinainte.")}
<h3>Starea, dintr-un clic</h3>
<p>Sus pe pagina programării e starea, cu butoanele pentru pasul următor (${b("Confirmat")}, ${b("A sosit")}, ${b("Începe tratamentul")}, ${b("Finalizat")}, ${b("Nu a venit")}) și pentru întoarcere: o programare anulată se poate ${b("Readuce la Programat")}, iar o vizită încheiată se poate ${b("Redeschide")}. Panoul verifică dacă ora mai e liberă când readuceți o programare anulată.</p>
${img("programare", "O programare deschisă: starea cu butoanele ei, datele, rechemarea și anularea.")}
<h3>Mutarea</h3>
<p>Cel mai simplu: trageți programarea în calendar (vezi capitolul Calendarul). Sau deschideți-o, schimbați ziua, ora, medicul sau cabinetul și apăsați ${b("Salvați")}. Pacientul primește noua oră, iar linkul vechi din mesaj nu mai merge.</p>
<h3>Anularea</h3>
<p>În chenarul ${b("Anulare")}: scrieți motivul (opțional) și apăsați ${b("Anulați programarea")}. Ora se eliberează, iar pacientul e anunțat. Și pacientul poate anula singur, din linkul primit, până cu câteva ore înainte; atunci clinica primește un e-mail.</p>
<h3>Rechemarea la control</h3>
<p>La ${b("Finalizat")}, rechemarea se pune singură. Dacă vreți altă dată sau alt motiv, în chenarul ${b("Rechemare la control")} alegeți peste cât timp și motivul, apoi ${b("Puneți rechemarea")}.</p>`,
});

export const absente = (rol) => ({
  titlu: "Absențe și zile libere",
  html: `
<p>${b("Absențe și zile libere")} (în meniu) ține concediile, cursurile și orele blocate ale medicilor${rol === "medic" ? "" : ", și zilele în care o clinică e închisă"}. Sărbătorile legale (inclusiv Paștele și Rusaliile ortodoxe) sunt știute automat și apar jos în pagină.</p>
${img("absente", "Absențele și zilele libere.")}
${pasi([
  rol === "medic" ? "Alegeți clinica (sau „La toate clinicile”) și tipul: concediu, formare / curs, interval blocat." : `Alegeți ${b("Un medic")} (și medicul) sau ${b("Clinica întreagă (închisă)")}, clinica și tipul: concediu, formare / curs, interval blocat, zi liberă.`,
  "Ziua de început și, dacă e mai mult de o zi, ziua de sfârșit.",
  "Pentru o parte din zi, ora de început și de sfârșit (de exemplu 14:00–18:00).",
  `Motivul (îl văd doar colegii) și ${b("Salvați absența")}.`,
])}
<p>Din acel moment, orele dispar de pe site și din chat, apar roșii în calendar, iar o programare nouă peste ele nu se mai poate face. Dacă existau deja programări în acel interval, panoul le arată imediat, ca să le mutați (pacientul primește noua oră).</p>
${sfat(rol === "medic" ? "Fiecare medic își poate pune și șterge singur absențele lui. Închiderile de clinică le pun recepția sau administratorul." : "Un medic își poate pune singur absențele lui, din contul lui. Coșul de lângă o absență o șterge, iar orele redevin libere.")}`,
});

export const programareOnline = (rol) => ({
  titlu: "Programările făcute de pacienți pe site",
  html: `
<p>Pe site, pagina ${b("Programare")} îl lasă pe pacient să-și aleagă singur ora, dintre orele libere reale ale medicilor. Durează un minut, în patru pași: motivul și clinica, ziua și ora (orice medic sau unul anume), cum se simte (emoții, inhalosedare), numele și telefonul. Se poate programa și un copil.</p>
${img("site-programare-ore", "Pe site: pacientul alege ziua și ora.")}
<p>Programarea intră <strong>direct în calendar</strong>, ca „Programat”, cu sursa „online” și cu mențiunea „Programare făcută de pacient pe site”. Recepția (și cine a cerut în Contul meu) e anunțată. Pacientul primește confirmarea cu un <strong>link</strong> de unde poate:</p>
<ul>
<li><strong>Confirma</strong> programarea (în panou trece la „Confirmat”);</li>
<li><strong>Anula</strong>, până cu câteva ore înainte (implicit 2; după aceea, doar la telefon). Clinica primește un e-mail, iar ora se eliberează;</li>
<li>pune programarea în <strong>calendarul telefonului</strong> și deschide harta.</li>
</ul>
${img("site-link", "Linkul pacientului: confirmare, calendar, hartă, anulare.")}
${tabel(["Ce vedeți în panou", "Ce faceți"], [
  ["O programare nouă, sursa „online”", "Nimic obligatoriu. Dacă pacientul a scris că îi e frică, medicul vede asta înainte."],
  ["O cerere „Nu a găsit o oră potrivită și vrea să fie sunat”", "Sunați-l și faceți programarea din cerere."],
  ["„Programare anulată de pacient”", "Ora e deja liberă; puteți suna pacientul pentru altă dată."],
])}
${sfat("Pe site apar doar orele în care medicul lucrează, nu are altă programare, nu e în concediu sau la curs, clinica e deschisă și nu e sărbătoare legală. De obicei, cel mai devreme peste două ore și cel mult 30 de zile înainte.")}
${rol === "admin" ? sfat("Ce servicii apar ca motive pe site și cât durează fiecare se alege la Servicii și prețuri (vezi capitolul acela). Celelalte setări ale programării online le face VITIM.") : ""}`,
});

// ── Patients ─────────────────────────────────────────────────────────────────────────────

export const pacienti = (rol) => ({
  titlu: "Pacienții și fișa pacientului",
  html: `
<h3>Căutarea</h3>
<p>În ${b("Pacienți")} scrieți numele, telefonul sau numărul fișei. Lista de etichete de lângă căutare arată doar pacienții cu o anumită etichetă (de exemplu „VIP”). Fără căutare, lista arată pacienții recenți, cu ultima vizită și următoarea programare.</p>
${img("pacienti", "Lista pacienților.")}
<h3>Un pacient nou</h3>
<p>${b("Pacient nou")} deschide fișa nouă: numele, CNP-ul (opțional; panoul îl verifică, completează singur data nașterii și sexul și îl păstrează criptat), telefonul, e-mailul, adresa, clinica preferată, medicul, cum se simte la stomatolog, observații.</p>
<ul>
<li><strong>Telefonul</strong>: alegeți dacă primește notificările pe ${b("SMS")}, pe ${b("WhatsApp")} sau deloc.</li>
<li><strong>Oferte și noutăți</strong>: bifați doar canalele pentru care pacientul și-a dat acordul (SMS, WhatsApp, e-mail). Fără acord, nu primește oferte.</li>
<li><strong>Minori</strong>: completați părintele sau tutorele; el semnează acordurile. Dacă tutorele e și el pacient, scrieți ${b("Nr. fișei tutorelui")}: fișele se leagă, iar pe fișa părintelui apare „În grija sa”.</li>
</ul>
${img("pacient-nou", "Fișa nouă de pacient.")}
<h3>Fișe dublate</h3>
<p>La salvarea unei fișe noi, panoul caută pacienți cu același telefon, CNP, e-mail sau cu același nume (și aceeași dată a nașterii). Dacă găsește, arată lista: deschideți fișa existentă sau, dacă e altă persoană (de exemplu un membru al familiei cu același telefon), bifați ${b("Este altă persoană: creați fișa nouă")}.</p>
${img("pacient-nou-dubluri", "Posibile fișe dublate, la o fișă nouă.")}
<h3>Fișa</h3>
<p>Sus: numele, numărul fișei, vârsta, telefonul și alertele. Butoanele ${b("Programare nouă")} și ${b("Sunați")} sunt mereu la îndemână. Filele: ${rol === "medic" ? `${b("Fișa")}, ${b("Odontogramă")}, ${b("Planuri de tratament")}, ${b("Documente și acorduri")}, ${b("Sterilizare")}, ${b("Mesaje")}` : `${b("Fișa")}, ${b("Planuri de tratament")}, ${b("Documente și acorduri")}, ${b("Sterilizare")}, ${b("Mesaje")}`}.</p>
${img(rol === "medic" ? "fisa-medic" : "fisa-receptie", rol === "medic" ? "Fișa văzută de medic: anamneza completă, programările, rechemările." : "Fișa văzută de recepție: alertele, datele, etichetele, programările, rechemările, notele.")}
<p>Pe fila ${b("Fișa")}: ${rol === "medic" ? "anamneza (alergii, medicamente, afecțiuni), " : "alertele medicale, "}datele pacientului, ${rol === "medic" ? "implanturile, " : ""}etichetele, programările, rechemările și notele.</p>
<h3>Etichetele</h3>
<p>În chenarul ${b("Etichete")} scrieți o etichetă (sau alegeți una existentă) și ${b("Adăugați")}; ${b("×")} o scoate. Exemple: „VIP”, „Ortodonție în curs”, „Plătește la sfârșit”, „Preferă dimineața”.</p>
${img("fisa-etichete", "Etichetele pacientului.", { mic: true })}
<h3>Notele</h3>
<p>${b("Notă nouă")} adaugă o notă cu data și autorul. ${rol === "medic" ? "Bifa „Notă clinică” (pusă implicit pentru medici) o ascunde de recepție. " : "Notele clinice ale medicilor nu se văd la recepție. "}Pioneza o <strong>fixează sus</strong> (de exemplu „Alergic la latex, anunțați medicul”). Autorul (sau administratorul) poate ${b("Modifica")} sau șterge nota lui.</p>
${img("fisa-note", "Notele: una fixată sus.", { mic: true })}
<h3>CNP-ul</h3>
<p>În fișă, CNP-ul apare mascat (2••••••••••01). Butonul ${b("Arătați CNP-ul întreg")} îl arată două minute; fiecare afișare se trece în jurnal, cu cine și când.</p>
${rol === "medic" ? "" : sfat("Anamneza completă o completează și o văd medicii. Recepția vede doar alertele, ca să știe, de exemplu, că pacientul ia anticoagulante.")}`,
});

export const cereri = () => ({
  titlu: "Cererile de pe site",
  html: `
<p>În ${b("Cereri online")} ajung cererile de programare (de la cei care preferă să fie sunați sau nu au găsit o oră potrivită), mesajele din pagina de contact și cererile din chatul de pe site. Bulina galbenă din meniu arată câte sunt noi; cine a cerut această notificare primește și un SMS, WhatsApp sau e-mail.</p>
${img("cereri", "Lista cererilor, cu filtrele pentru stare, cine se ocupă, tip și clinică.")}
<h3>O cerere, pas cu pas</h3>
${pasi([
  "Deschideți cererea: vedeți ce a cerut pacientul (serviciul, clinica, ziua și intervalul dorite, cum se simte, mesajul).",
  `Uitați-vă la ${b("Poate este deja pacient")}: dacă persoana are deja fișă, folosiți ${b("Programare pe această fișă")}, ca să nu faceți o fișă dublă.`,
  `Sunați-l (${b("Sunați")}). După apel, la ${b("Am sunat")} apăsați rezultatul: ${b("A răspuns")}, ${b("Nu răspunde")}, ${b("Ocupat")} sau ${b("Sună el înapoi")}; puteți scrie și ce s-a vorbit. Primul apel trece cererea „În lucru” și v-o dă dumneavoastră.`,
  `Când ați stabilit ora, apăsați ${b("Faceți programarea")}: formularul se completează cu datele din cerere, iar cererea trece singură la „Programat”.`,
  `Dacă nu se ajunge la o programare, alegeți ${b("Închisă")} și <strong>motivul</strong> (prețul, distanța, a ales altă clinică, nu răspunde etc.), apoi ${b("Salvați")}.`,
])}
${img("cerere", "O cerere: cine se ocupă, posibilele fișe existente, istoricul apelurilor, starea.")}
<ul>
<li><strong>Cine se ocupă</strong>: ${b("Mi-o iau eu")} sau alegeți colega și ${b("Salvați")}. Filtrul ${b("Se ocupă: Eu")} arată doar cererile dumneavoastră.</li>
<li><strong>Istoricul</strong>: fiecare apel, SMS, e-mail, notă, schimbare de stare sau de persoană, cu ora și cine a făcut-o. Pentru o notă, alegeți ${b("Notă")} la „Altceva”.</li>
</ul>
<h3>Tabloul</h3>
<p>${b("Tablou")} (sus) arată cererile pe coloane: Nouă, În lucru, Programat, Închisă (ultimele 30 de zile), cu cine se ocupă și ultimul apel. Butoanele de pe fiecare card le mută în altă coloană; ${b("Închideți…")} deschide cererea, ca să alegeți motivul.</p>
${img("cereri-tablou", "Tabloul cererilor.")}
${tabel(["Starea", "Când"], [
  ["Nouă", "A venit acum, nu s-a ocupat nimeni de ea."],
  ["În lucru", "Ați sunat sau ați scris, așteptați un răspuns."],
  ["Programat", "Pacientul are programare."],
  ["Închisă", "Nu mai e nimic de făcut, cu motivul ales. După perioada din setări (de obicei un an), se șterge singură."],
])}
${sfat("Cererile cu tipul „Din chat” au venit de la asistentul AI de pe site; ora aleasă de pacient e scrisă în cerere, iar linkul „Conversația” arată tot ce a scris. Motivele cererilor închise apar în Rapoarte, la „De ce nu s-au programat”.")}`,
});

export const rechemari = () => ({
  titlu: "Rechemările la control",
  html: `
<p>${b("Rechemări")} arată pacienții de sunat pentru control: întârziații și cei din următoarele 14 zile, la clinica aleasă (${b("Toate")} arată toate rechemările deschise).</p>
${img("rechemari", "Lista de sunat.")}
<p>Pentru fiecare pacient:</p>
<ul>
<li>${b("Programați")}: deschide o programare nouă pentru el; rechemarea se închide.</li>
<li>${b("Am sunat")}: notați încercarea (cu o ${b("Notă")}, de exemplu „nu răspunde, revin joi”).</li>
<li>${b("Peste o lună")}: amână rechemarea.</li>
<li>${b("Nu dorește")}: pacientul nu vrea control acum.</li>
</ul>
${sfat("Rechemările se pun singure când o vizită trece la „Finalizat” (dacă pacientul nu are deja una sau o programare viitoare). Cu o săptămână înainte de data rechemării, pacientul primește singur un mesaj, dacă notificarea e pornită.")}`,
});

// ── Money ────────────────────────────────────────────────────────────────────────────────

export const facturi = (rol) => ({
  titlu: "Facturi și încasări",
  html: `
<h3>Emiterea unei facturi</h3>
<p>Din fișa pacientului, fila ${b("Facturi și plăți")} → ${b("Factură nouă")}, sau din ${b("Facturi")} în meniu.</p>
${pasi([
  `<strong>Din planurile de tratament</strong>: lucrările acceptate sau efectuate, încă nefacturate. Cele efectuate sunt deja bifate.`,
  `<strong>Alte servicii</strong>: alegeți din lista de prețuri (prețul se completează singur) sau scrieți descrierea; dintele, cantitatea, prețul, reducerea, medicul. ${b("Mai multe rânduri")} adaugă rânduri.`,
  `<strong>Cumpărătorul</strong>: pe numele pacientului sau pe o firmă (pentru decontare: denumire, CUI, Reg. Com.).`,
  `<strong>Detalii și plata</strong>: clinica, cota TVA (serviciile stomatologice sunt scutite: 0), mențiuni și dacă se încasează acum (${b("Numerar")}, ${b("Card")}, ${b("Transfer")} sau ${b("Nu acum")}). Suma goală înseamnă tot totalul.`,
  `Verificați totalul de jos și apăsați ${b("Emiteți factura")}.`,
])}
${img("factura-noua", "Factura nouă.")}
${atentie("Factura emisă primește următorul număr din serie și nu se mai poate modifica. Dacă e greșită, administratorul o anulează (cu motiv) și se emite alta.")}
<h3>Factura emisă</h3>
<p>Pe pagina facturii: liniile, totalurile, plățile și restul de plată. ${b("Tipăriți")} o deschide pe A4 (sau o salvați ca PDF din fereastra de tipărire). Dacă a rămas ceva de plată, chenarul ${b("Încasare")} înregistrează plata. La plata în numerar se emite automat <strong>chitanța</strong>, care se tipărește din linkul ei.</p>
${img("factura", "O factură emisă, cu plățile.")}
<h3>Sold, avansuri și încasări fără factură</h3>
<p>Fila ${b("Facturi și plăți")} din fișă arată cât s-a facturat, cât s-a plătit și soldul (rest de plată sau avans). ${b("Înregistrați o încasare")} primește o plată pe o factură deschisă sau ca <strong>avans</strong> pe contul pacientului. Dacă sunt lucrări din plan nefacturate, o bandă galbenă vă amintește.</p>
${img("financiar", "Soldul pacientului, facturile și încasările.")}
<h3>Lista facturilor și jurnalul încasărilor</h3>
<p>${b("Facturi")} arată facturile unei perioade (implicit luna curentă), filtrate după clinică, stare (plătite, neplătite, anulate) sau după număr/pacient, cu totalurile perioadei. ${b("Încasări")} arată plățile (implicit azi), cu totalul pe metode (numerar, card, transfer) și pe zile. Ambele au ${b("Export Excel (CSV)")} pentru contabil.</p>
${img("incasari", "Jurnalul încasărilor: totalul pe metode de plată.")}
${rol === "admin" ? sfat("Doar administratorul poate anula o factură sau o încasare, cu motiv. Anularea nu șterge nimic: rămâne în evidență, iar plățile unei facturi anulate trec ca avans pe contul pacientului.") : sfat("Dacă ați greșit o factură sau o încasare, cereți administratorului să o anuleze; el scrie motivul și se emite una corectă.")}`,
});

// ── Documents, consents, tablet ──────────────────────────────────────────────────────────

export const documente = (rol) => ({
  titlu: "Documente și acorduri",
  html: `
<p>Fila ${b("Documente și acorduri")} din fișa pacientului are trei părți: semnarea pe tabletă, acordurile și documentele (radiografii, fotografii, acte semnate).</p>
${img("documente", "Documentele și acordurile pacientului.")}
<h3>Acordurile</h3>
<p>Sunt trei: <strong>prelucrarea datelor (GDPR)</strong>, <strong>consimțământul pentru tratament</strong> și <strong>fotografiile și radiografiile</strong>. Pentru fiecare vedeți dacă e semnat, cum și când. Fiecare acord se dă firmei clinicii: pe tabletă, firma clinicii tabletei (Cristești: S.C. Dental Arena S.R.L., Luduș: S.C. Dental Arena Ludus S.R.L.); pe hârtie, firma clinicii din care tipăriți. Acordurile de inhalosedare semnate înainte rămân în fișă, ca istoric.</p>
<ul>
<li><strong>Pe tabletă</strong> (recomandat): vezi capitolul următor.</li>
<li><strong>Pe hârtie</strong>: ${b("Formularul")} deschide textul cu numele pacientului, gata de tipărit. După semnare, în ${b("Înregistrați un acord semnat")} alegeți acordul, cum a fost dat (hârtie, tabletă, verbal), data și, ideal, încărcați copia scanată sau fotografiată.</li>
<li>${b("Retras")}: când pacientul își retrage acordul.</li>
</ul>
<h3>Documentele</h3>
<p>Alegeți fișierul (PDF, JPG, PNG sau WebP, cel mult 25 MB), tipul (radiografie panoramică, retroalveolară, CBCT, fotografie, consimțământ, deviz, scrisoare medicală) și un titlu, apoi ${b("Încărcați")}. Documentele se păstrează în afara site-ului și se deschid doar din panou, de cei care au acces la pacient. ${rol === "admin" ? "Doar administratorul poate șterge un document." : "Ștergerea o poate face doar administratorul."}</p>
<h3>Sterilizare</h3>
<p>Fila ${b("Sterilizare")} din fișa pacientului ține pozele cu eticheta pungii, indicatorul sau bonul autoclavului pentru instrumentele folosite la pacient. Scrieți, dacă vreți, o notă (de exemplu lotul), apoi apăsați ${b("Încarcă poză")}: pe telefon sau tabletă se deschide camera, pe calculator alegeți pozele (se pot alege mai multe deodată). Pozele se încarcă imediat și apar cu data, ora și cine le-a pus.</p>
<p><strong>Direct de pe telefon:</strong> apăsați ${b("Cod QR pentru telefon")} și scanați codul cu camera telefonului. Se deschide o pagină cu ${b("Faceți o poză")} și ${b("Alegeți din galerie")}; nu trebuie să intrați în panou pe telefon. Pozele apar singure în fila deschisă pe calculator, în câteva secunde. Codul e valabil o oră, doar pentru acel pacient (cel mult 40 de poze); ${b("Opriți codul")} îl închide mai devreme. Pe telefon se vede doar numele de familie cu inițiala și numărul fișei.</p>`,
});

export const tableta = (rol) => ({
  titlu: "Semnarea acordurilor pe tabletă",
  html: `
<p>Pacientul semnează acordurile pe tableta de la recepție, cu degetul, după un <strong>cod din 6 cifre</strong> pe care i-l dați. Nu e nevoie de hârtie și nici de scanare.</p>
<h3>La recepție</h3>
${pasi([
  `În fișa pacientului → ${b("Documente și acorduri")} → ${b("Semnare pe tabletă")}, bifați ce semnează. Panoul le bifează singur pe cele nesemnate încă.`,
  `Dacă vreți, bifați și ${b("Chestionarul medical")} (alergii, medicamente, boli) și ${b("Acordul pentru oferte")}.`,
  `Apăsați ${b("Dați un cod pentru tabletă")}. Codul apare mare pe ecran: spuneți-l pacientului și dați-i tableta. E valabil 30 de minute, o singură dată.`,
  `Pe ecran vedeți „Pacientul semnează acum pe tabletă…”; când termină, pagina se reîncarcă singură și acordurile apar ca „Semnat pe tabletă”.`,
])}
${img("tableta-fisa-cod", "Codul pentru tabletă, în fișa pacientului.")}
${sfat(`Un cod dat din greșeală se oprește cu ${b("Anulați codul")}. Un cod nou anulează automat codul vechi al aceluiași pacient.`)}
<h3>Pe tabletă (ce face pacientul)</h3>
${pasi([
  "Introduce codul pe tastatura de pe ecran.",
  "Vede numele lui sus. Dacă nu e el, apasă „Nu sunteți dumneavoastră? Ieșiți”.",
  "Citește fiecare acord și bifează „Am citit și sunt de acord”.",
  "Completează chestionarul (sau bifează „Nu am nimic de declarat”) și alege unde vrea oferte, dacă i s-a cerut.",
  "Semnează în chenar cu degetul și apasă „Semnez și trimit”.",
])}
${img("tableta-cod", "Pe tabletă: introducerea codului.")}
${img("tableta-semnare-sus", "Pe tabletă: acordurile de citit și de bifat.")}
${img("tableta-semnare-jos", "Pe tabletă: chestionarul, ofertele și semnătura.")}
<p>După semnare, tableta mulțumește și revine singură la ecranul cu codul. Dacă pacientul lasă tableta 3 minute fără să o atingă, se întoarce la început, ca următorul să nu vadă nimic.</p>
<h3>Ce rămâne în fișă</h3>
<p>Linkul ${b("acordul semnat")} arată textul exact semnat, semnătura, ora și tableta, plus o <strong>amprentă digitală</strong>: panoul verifică la fiecare deschidere că documentul nu a fost schimbat. Se poate tipări sau salva ca PDF. Chestionarul completat apare în fișă și îl verifică medicul înainte să intre în anamneză.</p>
${img("acord-semnat", "Acordul semnat pe tabletă, verificat.", { mic: true })}
${rol === "vitim" ? `<h3>Asocierea tabletei (o singură dată)</h3>
${pasi([
  `Pe tabletă, deschideți <span class="adresa-inline">dentalarena.ro/admin/tablete</span> și intrați cu contul VITIM.`,
  `Dați tabletei un nume (de exemplu „Recepție Luduș”), alegeți clinica și apăsați ${b("Asociați această tabletă")}.`,
  "Contul se închide singur pe tabletă, iar tableta deschide pagina de semnare. Puneți-o pe ecranul de pornire și activați „Acces ghidat” (iPad) sau „Fixarea aplicației” (Android), ca pacienții să nu poată ieși din ea.",
])}
<p>O tabletă pierdută se oprește din aceeași pagină, cu ${b("Opriți")}: nu mai poate deschide semnarea.</p>
${img("tablete", "Tabletele de semnare.")}` : ""}`,
});

// ── Messages, chat, reports ──────────────────────────────────────────────────────────────

export const mesaje = (rol) => ({
  titlu: "Mesajele către pacienți",
  html: `
<p>Panoul trimite singur pacienților mesajele obișnuite, pe SMS, WhatsApp sau e-mail, cum a ales fiecare în fișă:</p>
${tabel(["Când", "Ce primește pacientul"], [
  ["Imediat după programare", "Confirmarea: ziua, ora, clinica, medicul și un link de unde confirmă, anulează sau pune programarea în calendarul telefonului."],
  ["La mutare sau anulare", "Noua dată (cu un link nou), sau anunțul anulării."],
  ["Cu o zi înainte", "Reamintirea programării."],
  ["După o vizită", "Mulțumiri și, eventual, linkul pentru o recenzie Google."],
  ["Cu o săptămână înainte de control", "Reamintirea controlului (rechemare)."],
  ["De ziua lui", "Urarea (doar cu acordul pentru oferte)."],
])}
<h3>Mesajele unui pacient</h3>
<p>Fila ${b("Mesaje")} din fișă arată tot ce i s-a trimis și tot ce a răspuns. Jos îi puteți scrie un mesaj acum, pe canalul ales.</p>
${img("pacient-mesaje", "Mesajele unui pacient.")}
${sfat("Pe WhatsApp, un text liber pleacă doar în 24 de ore după ce pacientul v-a scris. În rest, WhatsApp permite doar mesajele cu șablon aprobat, pe care panoul le trimite singur. SMS-ul are 160 de caractere fără diacritice; un mesaj mai lung costă mai multe SMS-uri.")}
<h3>Pagina Mesaje</h3>
<p>Sus: <strong>mesajele primite pe WhatsApp</strong> de la pacienți (răspundeți din fișa lor, fila Mesaje). Dedesubt: jurnalul tuturor mesajelor plecate, cu starea lor (în așteptare, trimis, livrat, citit, eșuat). Un mesaj eșuat se poate trimite din nou cu ${b("Reîncercați")}; unul în așteptare se oprește cu ${b("Nu mai trimiteți")}.</p>
${img("mesaje", "Mesajele primite și jurnalul mesajelor.")}
${rol === "admin" ? "" : sfat("Dacă un pacient nu primește mesajele, verificați în fișă telefonul și canalul ales (SMS, WhatsApp sau fără mesaje).")}`,
});

export const chat = (rol) => ({
  titlu: "Chatul de pe site",
  html: `
<p>Pe site, butonul ${b("Întrebați-ne")} deschide un asistent AI care răspunde vizitatorilor oricând: servicii, prețuri, medici, program, adrese. El poate și <strong>programa</strong>: caută orele libere din calendar (după programul medicilor), iar vizitatorul alege una.</p>
${img("chat-ore", "Pe site: asistentul propune orele libere ca butoane.")}
<ul>
<li>În modul <strong>Cerere</strong>, ora aleasă ajunge ca cerere în ${b("Cereri online")} (tip „Din chat”): sunați pacientul, confirmați și faceți programarea.</li>
<li>În modul <strong>Direct în calendar</strong>, pacientul primește un cod prin SMS și, după ce îl scrie în chat, programarea intră direct în calendar, cu mențiunea „Programare făcută de pacient în chatul de pe site”. Recepția poate fi anunțată pe telefon.</li>
</ul>
<p>Meniul ${b("Chat pe site")} arată toate conversațiile: ce au întrebat vizitatorii, ce s-a întâmplat (doar întrebări, cerere, programare) și linkurile spre programare, fișă sau cerere.</p>
${img("chat", "Conversațiile din chat.")}
${sfat("Asistentul nu vede fișele pacienților, nu pune diagnostice și trimite urgențele la telefonul clinicii (sau 112). Conversațiile se șterg automat după perioada din setări.")}
${rol === "admin" ? sfat("Chatul îl pornește și îl setează suportul tehnic (VITIM).") : ""}`,
});

export const rapoarte = (rol) => ({
  titlu: "Rapoarte",
  html: `
<p>${b("Rapoarte")} arată cifrele unei perioade (implicit luna curentă; scurtături: ${b("Luna aceasta")}, ${b("Luna trecută")}, ${b("Anul acesta")}), pe clinică.</p>
${rol === "admin" ? `<ul>
<li><strong>Programări</strong>: pe medic, efectuate, anulate, rata neprezentărilor, câte au venit de pe site.</li>
<li><strong>Cereri de pe site</strong>: câte au venit, pe servicii, și câte au devenit programări (conversia).</li>
<li><strong>De ce nu s-au programat</strong>: motivele cererilor închise fără programare.</li>
<li><strong>Pacienți noi</strong> în perioadă.</li>
</ul>
${img("rapoarte", "Rapoartele.")}
${img("rapoarte-pierdute", "De ce nu s-au programat cererile.", { mic: true })}
<p>Fiecare tabel are export CSV, pentru Excel. Cifrele financiare (facturat, încasat, venit pe medic) apar aici când se pornește partea financiară.</p>` : rol === "medic" ? `<p>Medicul vede programările lui și neprezentările.</p>${img("rapoarte-medic", "Rapoartele, văzute de un medic.")}` : `<p>Recepția vede programările (pe medic, efectuate, neprezentări) și cererile de pe site.</p>`}`,
});

// ── Doctors ──────────────────────────────────────────────────────────────────────────────

export const anamneza = () => ({
  titlu: "Anamneza, alertele și notele clinice",
  html: `
<p>Pe fila ${b("Fișa")}, chenarul ${b("Anamneza")}: alergiile, medicamentele luate acum, afecțiunile (anticoagulante, boală cardiacă, hipertensiune, diabet, astm, epilepsie, hepatită, HIV, tulburări de coagulare, bifosfonați, sarcină, fumător) și alte observații. Apăsați ${b("Salvați anamneza")}. Panoul notează data verificării.</p>
${sfat("Alergiile și afecțiunile bifate apar ca etichete roșii la fiecare programare: pe pagina Azi, în calendar și în programul trimis dimineața.")}
<h3>Chestionarul completat de pacient pe tabletă</h3>
<p>Dacă pacientul a completat chestionarul pe tabletă, în anamneză apare o bandă galbenă cu răspunsurile lui:</p>
<ul>
<li>${b("Treceți în anamneză")}: afecțiunile bifate se adaugă, iar textele se adaugă după ce era scris. Nimic din anamneza existentă nu se șterge. Verificați apoi și salvați dacă mai schimbați ceva.</li>
<li>${b("Puneți deoparte")}: chestionarul nu intră în fișă (de exemplu dacă e completat greșit).</li>
</ul>
${img("chestionar", "Chestionarul pacientului, în așteptarea medicului.")}
<h3>Notele</h3>
<p>Jos în fișă, ${b("Notă nouă")}. Bifa „Notă clinică” (pusă implicit pentru medici) o ascunde de recepție. Pioneza fixează nota sus; autorul o poate modifica sau șterge (vezi capitolul despre fișă).</p>`,
});

export const odontograma = () => ({
  titlu: "Odontograma",
  html: `
<p>Fila ${b("Odontogramă")} arată dinții în numerotarea FDI (11–48; ${b("Arătați dinții temporari")} pentru 51–85). Sus e arcada superioară; dreapta pacientului e în stânga ecranului.</p>
${pasi([
  "Apăsați pe un dinte: se deschide ce e notat pe el.",
  `La ${b("Constatare nouă")} alegeți ce ați constatat sau ce s-a făcut (carie, obturație, tratament de canal, coroană, implant, extracție etc.) și suprafețele (M, O, D, V, L), cu o notă dacă e cazul.`,
  `Apăsați ${b("Notați")}. Dintele se colorează: roșu pentru carie sau fractură, verde pentru obturație sau fațetă, contur pentru coroană, punte sau implant, X pentru extras sau lipsă.`,
])}
${img("odontograma-dinte", "Odontograma, cu dintele 36 deschis.")}
<ul>
<li>${b("Trecut în istoric")}: o constatare rezolvată (de exemplu o carie obturată). Nu se șterge; o vedeți cu ${b("Arătați istoricul")}.</li>
<li>${b("Înlocuiește tot ce e notat la acest dinte")}: după o extracție sau o reabilitare completă.</li>
<li>${b("Adăugați în plan")}: pune lucrarea pentru acest dinte într-un plan de tratament, cu prețul din listă.</li>
</ul>`,
});

export const planuri = (rol) => ({
  titlu: "Planurile de tratament",
  html: `
<p>Fila ${b("Planuri de tratament")} arată planurile pacientului, cu starea, valoarea și cât s-a efectuat. ${rol === "receptie" ? "Medicii le fac; recepția le vede și le tipărește pentru pacient." : ""}</p>
${img("plan", "Un plan de tratament: faze, lucrări, prețuri, starea fiecărei lucrări.")}
${rol === "receptie" ? "" : `<h3>Un plan nou</h3>
${pasi([
  `${b("Plan nou")} (sau din odontogramă, ${b("Adăugați în plan")}).`,
  `La ${b("Adăugați o lucrare")}: serviciul din lista de prețuri (prețul se completează singur și îl puteți schimba), dintele, faza (1, 2, 3…), cantitatea, reducerea. ${b("Adăugați lucrarea")}.`,
  `În ${b("Detaliile planului")}: titlul, medicul, clinica, până când sunt valabile prețurile, observațiile.`,
])}`}
<h3>Pașii unui plan</h3>
${tabel(["Starea planului", "Ce înseamnă"], [
  ["Ciornă", "Se lucrează la el; prețurile se pot schimba."],
  ["Prezentat", "I s-a arătat pacientului (tipărit sau explicat)."],
  ["Acceptat", "Pacientul e de acord. Prețurile nu se mai schimbă."],
  ["În curs", "Lucrările au început."],
  ["Finalizat / Respins / Anulat", "Planul s-a încheiat."],
])}
<p>Fiecare lucrare are starea ei: ${b("Propus")} → ${b("Acceptat")} → ${b("Programat")} → ${b("Efectuat")} (sau ${b("Anulat")}).</p>
<p>${b("Tipăriți")} scoate planul cu devizul pe A4, de dat pacientului sau de semnat.</p>
${img("plan-tipar", "Planul tipărit (devizul).", { mic: true })}`,
});

export const proceduri = (rol) => ({
  titlu: "Proceduri și plăți",
  html: `
<p>Fila ${b("Proceduri și plăți")} din fișa pacientului arată, ca în QDental, <strong>procedurile efectuate</strong> (data, dintele, procedura, medicul, cât e de plată, cât s-a achitat și cât a rămas) și <strong>plățile pacientului</strong>. Sus sunt totalurile: ${b("Total de plată")}, ${b("Achitat")}, ${b("Rămas de plată")} și ${b("Avans")} (ce a plătit în plus). Procedurile din 2026 aduse din QDental au medicul necompletat și plățile „Din QDental”.</p>
${rol !== "receptie" ? `<h3>Adaugă procedură (medicul, după fiecare intervenție)</h3>
${pasi([
  `În fișa pacientului, fila ${b("Proceduri și plăți")} → ${b("Adaugă procedură")}. Mai repede: din programarea pacientului care a sosit (sau din meniul ei din calendar), ${b("Proceduri efectuate")}: ziua, medicul și clinica sunt deja completate.`,
  `Alegeți procedura din lista de prețuri: prețul se completează singur (îl puteți schimba). Dacă nu e în listă, scrieți-o la „Sau scrieți procedura”.`,
  `Dintele: un număr (16) sau mai mulți (13, 14, 15): se face câte un rând pentru fiecare dinte, fiecare cu prețul de sus.`,
  `Opțional: reducerea (%), costul de laborator, observații. Debifați „Procedura e efectuată” pentru una începută, care încă nu se plătește.`,
  `${b("Adăugați procedura")}.`,
])}
${sfat("O procedură greșită se poate modifica sau șterge din rândul ei („Modificați”), de cel care a adăugat-o, în aceeași săptămână; după aceea, de administrator. Ce se plătise pentru ea rămâne ca avans.")}` : ""}
${rol !== "medic" ? `<h3>Încasare (recepția)</h3>
${pasi([
  `Jos, la ${b("Încasare")}: suma (e completat ce mai are de plată), data, numărul chitanței, clinica și cum a plătit (numerar, card, transfer, altă plată).`,
  `${b("Înregistrați plata")}: plata se trece pe procedurile neachitate, de la cea mai veche. Ce rămâne în plus e avans și se folosește singur la următoarea procedură.`,
])}
${sfat("O plată greșită o anulează administratorul (rămâne în listă, tăiată).")}` : ""}
<h3>Pagina Proceduri (meniu)</h3>
<p>${b("Proceduri")} din meniu arată procedurile dintr-o perioadă (ca „Statistică proceduri” din QDental), pe medic și pe clinică, cu totalurile: de plată, achitat, rămas și încasat în perioadă. Bifați ${b("Doar neachitate")} ca să vedeți cine mai are de plată. Un medic își vede implicit procedurile lui. Un clic pe pacient deschide fișa lui.</p>`,
});

export const consultatieAi = () => ({
  titlu: "Consultația cu AI",
  html: `
<p>În fișă, ${b("Consultație cu AI")}. Dictați consultația sau lăsați calculatorul (ori telefonul) să asculte discuția cu pacientul. AI-ul propune: <strong>nota clinică</strong>, <strong>anamneza</strong> (alergii, medicamente, afecțiuni), <strong>constatările pe dinți</strong> și <strong>lucrările pentru plan</strong>, plus ce trebuie verificat.</p>
${pasi([
  `Apăsați ${b("Dictați")} și vorbiți clar, în română (de exemplu „carie distală pe 36, obturație compozit; propun coroană pe 46”). Textul apare în chenar și îl puteți corecta de mână. Funcționează în Chrome, Edge și Safari.`,
  `Apăsați ${b("Analizați cu AI")}. Durează de obicei sub un minut.`,
  "Citiți propunerile și bifați doar ce e corect.",
  `Apăsați ${b("Treceți în fișă ce e bifat")}: nota, anamneza, constatările pe dinți și lucrările din plan intră în fișă.`,
])}
${img("consultatie-ai", "Consultația cu AI.")}
${atentie("Nimic nu intră în fișă fără să bifați. AI-ul poate greși: verificați mai ales numărul dintelui și alergiile. Spuneți-i pacientului când înregistrați discuția.")}
${sfat("Înainte să plece textul, panoul scoate din el numele pacientului, CNP-ul și numerele de telefon.")}`,
});

export const programulZilei = (rol) => ({
  titlu: "Programul zilei pe WhatsApp",
  html: `
<p>În fiecare zi în care ${rol === "medic" ? "aveți" : "medicul are"} programări, ${rol === "medic" ? "primiți" : "primește"} dimineața, la ora aleasă, lista lor pe WhatsApp (sau SMS ori e-mail): ora, pacientul, motivul, clinica și, dacă se dorește, alertele medicale. Dacă în aceeași zi se adaugă, se mută sau se anulează o programare, ${rol === "medic" ? "primiți" : "primește"} și asta.</p>
${img("medic-agenda", "Setarea din pagina medicului, cu exemplul de mesaj.")}
${rol === "medic" ? `<p>Setarea o face administratorul, în Echipa → profilul dumneavoastră. Dacă aveți cont în panou, o puteți cere și singur, din ${b("Contul meu")} → ${b("Notificările mele")} → „Programul zilei”.</p>` : `${pasi([
  `${b("Echipa")} → medicul → chenarul ${b("Programul zilei, pe telefon")}.`,
  `Alegeți unde îl primește (${b("WhatsApp")}, ${b("SMS")} sau ${b("E-mail")}), scrieți mobilul (sau e-mailul) și ora (de exemplu 07:30, înaintea primei programări).`,
  `Bifați ${b("Cu alertele medicale ale pacienților")} doar dacă telefonul medicului e protejat (sunt date de sănătate).`,
  `${b("Salvați")}. Cu ${b("Trimiteți acum programul medicului (probă)")} verificați că ajunge.`,
])}
${atentie("Pe WhatsApp, Meta cere un șablon aprobat (vezi capitolul despre mesaje: textul propus e în Setări → Mesaje → „Programul zilei”). Până la aprobare, programul pleacă prin SMS. Mesajul pleacă la oră doar dacă rulează Cron Job-ul la 5 minute.")}`}`,
});

// ── Administrator ────────────────────────────────────────────────────────────────────────

export const setari = () => ({
  titlu: "Setări: clinicile și firmele lor, Facebook, modulele, acordurile",
  html: `
<p>${b("Setări")} (doar VITIM). Sus sunt butoanele spre celelalte setări: Mesaje, Asistentul AI, Tablete de semnare, Programări online, Chatul de pe site, Actualizare.</p>
${img("setari", "Setările generale.")}
${tabel(["Secțiunea", "Ce conține"], [
  ["Pagina de Facebook", "Adresa paginii clinicii și dacă postările ei apar pe prima pagină a site-ului (secțiunea „Ce mai facem”). Vizitatorul le vede după ce acceptă cookie-urile Facebook."],
  ["Cererile de pe site", "E-mailul care primește cererile și câte zile se păstrează cererile închise (recomandat 365; apoi se șterg singure)."],
  ["Module", "Partea financiară (facturi, încasări, sold, venituri în rapoarte): oprită în perioada de probă. Bifată, apar meniurile Facturi și Încasări și secțiunea Facturare, cu seria de facturi și de chitanțe a fiecărei clinici (fiecare firmă își numerotează singură documentele)."],
  ["Textele acordurilor", "Textele celor 3 acorduri. {{pacient}}, {{firma}} (firma clinicii unde se semnează), {{clinica}} și {{email}} se completează singure; la sfârșitul fiecărui acord se scrie singură firma căreia i se dă. La o schimbare, versiunea se schimbă singură."],
  ["Clinicile", "Pentru Cristești și Luduș: numele, adresa, telefonul, e-mailul (primește cererile acelei clinici), programul ca text pe site, orele pe zile, câte cabinete și firma clinicii: denumirea, CUI, Nr. Reg. Com., sediul, banca și IBAN."],
])}
${img("setari-module", "Modulele: partea financiară.", { mic: true })}
<h3>Clinica: orele, cabinetele, firma</h3>
<ul>
<li><strong>Orele clinicii, pe zile</strong> (cu o pauză opțională): taie programul medicilor, deci pe site nu apar ore în care clinica e închisă; în calendar, orele închise sunt gri. Dacă textul „Programul” e gol, se scrie singur din ele.</li>
<li><strong>Cabinete</strong>: cu mai multe, calendarul se poate vedea și pe cabinete, iar o programare are cabinetul ei. Cabinetul obișnuit al fiecărui medic se alege la Echipa.</li>
<li><strong>Firma clinicii</strong>: Cristești este S.C. Dental Arena S.R.L. (CUI RO30570968), Luduș este S.C. Dental Arena Ludus S.R.L. (CUI RO30611278). Firma apare pe acordurile semnate la acea clinică (și pe tabletă), pe facturi, în subsolul site-ului și în paginile legale. Completați și Nr. Reg. Com. și sediul social.</li>
</ul>
${img("setari-clinica", "Clinica: datele, orele pe zile, cabinetele și firma ei.")}
${atentie("Toate modificările din Setări ajung la administrator: pe pagina Azi și într-un e-mail de rezumat (vezi capitolul despre rolul VITIM).")}`,
});

export const utilizatori = () => ({
  titlu: "Conturile echipei",
  html: `
<p>${b("Utilizatori")} (doar VITIM) arată conturile, cu rolul și clinicile fiecăruia.</p>
${img("utilizatori", "Conturile panoului.")}
${pasi([
  `${b("Cont nou")}: numele, e-mailul (cu el intră în panou) și rolul: ${b("Recepție")}, ${b("Medic")}, ${b("Administrator")}, ${b("Administrator medic")} sau ${b("Suport tehnic (VITIM)")}.`,
  "Bifați clinicile în care lucrează persoana (administratorii și VITIM le văd pe amândouă).",
  `Pentru un medic sau un administrator medic, alegeți ${b("Profilul de medic")}: programările lui apar la el și primește notificările lor. La administratorul medic profilul e obligatoriu.`,
  `Scrieți o ${b("Parola de început")} și spuneți-o persoanei. La prima intrare își alege una nouă.`,
])}
${img("utilizator", "Un cont: rolul, clinicile, profilul de medic.")}
${tabel(["Rolul", "Pe scurt"], [
  ["Recepție", "Lucrul zilnic, fără anamneza completă și fără administrare."],
  ["Medic", "Fișa completă, odontograma, planurile, implanturile, consultația cu AI."],
  ["Administrator", "Tot ce ține de clinică: rapoarte, prețuri, echipă, marketing, GDPR, jurnal. Nu vede Setările și Utilizatorii cât timp există un cont VITIM activ."],
  ["Administrator medic", "Tot ce are administratorul, plus tot ce are medicul: consultații (și cu AI), anamneza, odontograma, planurile, notele, implanturile. Programările noi făcute de el se pun implicit la el."],
  ["Suport tehnic (VITIM)", "Tot, plus Setările și Utilizatorii. Ce schimbă ajunge la administrator."],
])}
${sfat("Când cineva pleacă din echipă, debifați „Contul este activ”: nu mai poate intra, dar tot ce a făcut rămâne în jurnal. Dacă cineva și-a uitat parola, scrieți-i o parolă nouă de început. Jos în pagina contului, „Închideți toate sesiunile contului” îl scoate din panou de pe orice dispozitiv (de exemplu un telefon pierdut).")}`,
});

export const echipa = () => ({
  titlu: "Echipa: medicii pe site și programul lor",
  html: `
<p>${b("Echipa")} arată medicii, în ordinea de pe site. Săgețile ${b("↑")} ${b("↓")} de lângă fiecare medic îi schimbă locul: aceeași ordine apare pe site, în coloanele calendarului și la programarea online. Un medic se deschide cu un clic; ${b("Medic nou")} adaugă unul.</p>
${img("medic-profil", "Profilul unui medic.")}
${tabel(["Chenarul", "Ce setați"], [
  ["Pe site", "Numele afișat, specialitatea, prenumele și numele, textul „Despre medic”, ordinea, dacă apare pe site și dacă primește programări de pe site (și din chat)."],
  ["Unde și când lucrează", "Clinicile bifate (medicul apare în calendarul lor), programul pe zile la fiecare clinică, cu o pauză opțională (de exemplu 13:00–14:00), și cabinetul în care lucrează de obicei. Din program se calculează orele libere de pe site."],
  ["Programul zilei, pe telefon", "Lista programărilor trimisă dimineața pe WhatsApp, SMS sau e-mail (vezi capitolul despre programul zilei)."],
  ["Portretul", "O fotografie verticală, cu fața în treimea de sus. Fără portret, pe site apar inițialele."],
  ["Serviciile", "Ce face medicul: Nu / Da / Da, și apare la „Cine vă tratează” pe pagina serviciului. Pe site, la programare, un motiv se oferă doar medicilor care fac acel serviciu."],
])}
${img("medic-program", "Programul pe zile, cu pauza, la fiecare clinică.")}
${sfat("Lăsați goale zilele în care medicul nu lucrează la acea clinică. Fără program, medicul nu primește programări de pe site, dar recepția îl poate programa normal. Concediile și cursurile se pun la Absențe și zile libere, nu aici.")}`,
});

export const servicii = () => ({
  titlu: "Servicii și prețuri",
  html: `
<p>${b("Servicii și prețuri")} arată serviciile site-ului (de exemplu Odontologie, Endodonție, Implantologie), fiecare cu pagina lui pe site și cu lista lui de prețuri (sub-serviciile). Ce schimbați aici apare pe site imediat și se folosește la planuri și la programări.</p>
<h3>Serviciile (paginile)</h3>
<ul>
<li>${b("Serviciu nou")} (în dreapta): numele și o descriere scurtă. Se face pagina lui pe site, de exemplu „Albire dentară” → dentalarena.ro/albire-dentara, și apare în meniul Servicii, pe pagina Servicii, la Prețuri și la programare.</li>
<li>Săgețile ${b("↑")} ${b("↓")} schimbă ordinea serviciilor: așa apar în meniul site-ului și pe paginile Servicii și Prețuri.</li>
<li>Într-un serviciu, la ${b("Pagina pe site")}: numele, descrierea scurtă, fraza de sub titlu și textul paginii (paragrafele se despart cu un rând gol). Debifat „Serviciul apare pe site”, pagina dispare de pe site, dar rămâne în panou.</li>
<li>${b("Ștergeți serviciul")} (jos în pagină) scoate pagina și prețurile ei. Prețurile folosite deja în planuri sau facturi rămân în istoric, ascunse.</li>
<li>Medicii care fac serviciul se bifează la Echipa → medic (apar pe pagina lui la „Cine vă tratează”).</li>
</ul>
${img("servicii-pagina", "Prețurile unei pagini de servicii.")}
<h3>Prețurile (sub-serviciile)</h3>
<ul>
<li>Fiecare rând: numele, prețul, bifa „de la”, un al doilea preț (pentru „200 / 400 lei”), unitatea (de exemplu „/dinte”), bifa „pe site” și prețul reprezentativ (cel afișat pe cardul serviciului). Prețul gol înseamnă „Prețul îl aflați la telefon”.</li>
<li><strong>Durează</strong>: cât ține serviciul. Pe site, programarea pentru el ocupă atât.</li>
<li><strong>Programare online</strong>: bifat, serviciul apare ca motiv pe pagina Programare de pe site, cu textul pentru pacient (de exemplu „Consultație sau control”) și o explicație scurtă. „Urgență” îl pune al doilea, evidențiat, cu telefoanele clinicilor.</li>
<li>${b("Adăugați un preț (sub-serviciu)")} pune un rând nou; săgețile îl mută; coșul îl șterge.</li>
<li>La sfârșit, ${b("Salvați prețurile")}.</li>
</ul>
${img("servicii-online", "Un serviciu oferit ca motiv de programare pe site.")}
${sfat("Prețurile din planurile deja acceptate nu se schimbă când modificați lista. Pe site, la motive, apare la sfârșit și „Nu știu sigur”, programat ca o consultație.")}`,
});

export const fotografii = () => ({
  titlu: "Fotografiile site-ului",
  html: `
<p>${b("Fotografii site")} arată fiecare loc cu fotografie de pe site (prima pagină, despre noi, clinici, servicii). Pentru fiecare: ${b("Fotografie nouă")} (JPG, PNG sau WebP) o înlocuiește; panoul o micșorează singur pentru telefon și calculator. ${b("Fotografia inițială")} pune înapoi fotografia de la început.</p>
${img("fotografii", "Locurile cu fotografii.")}`,
});

export const setariMesaje = () => ({
  titlu: "Setările mesajelor: SMS, WhatsApp, e-mail",
  html: `
<p>${b("Setări")} → ${b("Mesaje: SMS, WhatsApp, e-mail")}.</p>
${img("setari-mesaje", "Setările mesajelor.")}
<h3>Modul de lucru</h3>
<ul>
<li><strong>Probă</strong>: mesajele nu pleacă, doar se trec în jurnal. Bun pentru început și pentru verificarea textelor.</li>
<li><strong>Trimitere reală</strong>: mesajele pleacă. Porniți-l după ce ați completat conturile și ați trimis o probă.</li>
</ul>
<h3>Conturile</h3>
<ul>
<li><strong>SMS (SMSLink.ro)</strong>: Connection ID, parola, expeditorul (numele afișat, dacă e aprobat) și „fără diacritice” (un SMS fără diacritice are 160 de caractere; cu diacritice, 70).</li>
<li><strong>WhatsApp Business (Meta)</strong>: Phone number ID, tokenul permanent, App Secret, limba șabloanelor (ro). În Meta, la Webhook, puneți adresa și tokenul de verificare afișate în panou, ca să vedeți livrările, citirile și răspunsurile pacienților.</li>
<li><strong>Linkul pentru recenzii</strong>: din Google Business Profile; apare în mesajul de după vizită.</li>
</ul>
<h3>Textele</h3>
<p>Pentru fiecare mesaj către pacienți: dacă pleacă pe telefon și/sau pe e-mail, textul SMS/WhatsApp, numele șablonului WhatsApp aprobat de Meta, subiectul și textul e-mailului. Valorile dintre acolade ({prenume}, {data}, {ora}, {clinica}, {medic}…) se completează singure. La „Mesaje către echipă” sunt textele pentru echipă; pentru „Programul zilei” e afișat și textul propus pentru șablonul WhatsApp.</p>
${atentie("WhatsApp: mesajele trimise de clinică cer un șablon aprobat de Meta (categoria Utility pentru notificări, Marketing pentru oferte). Fără șablon, pacienții care au ales WhatsApp primesc SMS.")}
<p>${b("Mesaj de probă")} (jos) trimite de-adevăratelea un SMS sau WhatsApp la un număr, ca să verificați contul.</p>`,
});

export const marketing = () => ({
  titlu: "Marketing: campanii SMS, WhatsApp, e-mail",
  html: `
<p>${b("Marketing")} arată câți pacienți au acceptat oferte pe fiecare canal și campaniile trimise, cu numerele lor (destinatari, trimise, eșuate, în așteptare).</p>
${img("marketing", "Campaniile și acordurile pentru oferte.")}
${pasi([
  `${b("Campanie nouă")}: un nume (doar pentru dumneavoastră) și canalul.`,
  `Cui: clinica, ${b("Fără vizită de cel puțin (luni)")}, cei care ${b("Au făcut deja")} un serviciu, cei care ${b("Au un plan de tratament neterminat")} sau cei care ${b("Își serbează ziua luna aceasta")}. Doar pacienții activi care au acceptat oferte pe acel canal.`,
  `Textul (cu {prenume}); pentru WhatsApp, șablonul de marketing aprobat; pentru e-mail, subiectul. Linkul de dezabonare se adaugă singur.`,
  `${b("Actualizați numărul de destinatari")}, apoi ${b("Trimiteți-mi o probă")} (la telefonul din Contul meu).`,
  `Trimiteți acum sau alegeți ziua și ora și apăsați ${b("Programați")}. ${b("Salvați ciorna")} o păstrează pentru mai târziu.`,
])}
${img("campanie-noua", "O campanie nouă.")}
${atentie("Ofertele pleacă doar între orele 10 și 20 și doar celor care și-au dat acordul. Pacientul se poate dezabona oricând, din linkul din mesaj, iar panoul îl scoate singur din liste.")}`,
});

export const setariAi = () => ({
  titlu: "Asistentul AI (Anthropic)",
  html: `
<p>Consultația cu AI și chatul de pe site folosesc modelele Claude ale firmei Anthropic.</p>
${pasi([
  "Pe console.anthropic.com faceți un cont de firmă, adăugați o metodă de plată și creați o cheie API.",
  `În ${b("Setări")} → ${b("Asistentul AI")} bifați „pornit”, lipiți cheia (începe cu sk-ant-), alegeți modelul și cât de atent lucrează, apoi ${b("Salvați")}.`,
  `${b("Testați conexiunea")}.`,
])}
${img("setari-ai", "Setările asistentului AI.")}
${sfat("Cheia se păstrează criptat și nu se mai afișează. Costul e de regulă de câțiva cenți pe consultație; consumul se vede în console.anthropic.com, iar pentru chat și în Chat pe site.")}
${atentie("Acceptați termenii comerciali Anthropic (cuprind acordul de prelucrare a datelor) și menționați asistentul AI în Politica de confidențialitate a site-ului.")}`,
});

export const gdpr = () => ({
  titlu: "GDPR: cererile pacienților, exportul, anonimizarea",
  html: `
<h3>Registrul cererilor</h3>
<p>${b("Cereri GDPR")} e registrul cererilor privind datele personale (acces, corectare, ștergere, portabilitate, restricționare, opoziție). Legea dă 30 de zile pentru răspuns; panoul arată termenul.</p>
${pasi([
  `${b("Cerere nouă")}: cine a cerut, telefonul sau e-mailul, ce cere, numărul fișei (dacă e pacient) și data primirii.`,
  "Rezolvați cererea (de exemplu cu exportul sau anonimizarea de mai jos).",
  `Scrieți ${b("Ce s-a făcut")}, treceți starea și ${b("Salvați")}.`,
])}
${img("gdpr", "Registrul cererilor GDPR.")}
<h3>Pe fișa pacientului</h3>
<p>Fila ${b("GDPR")} (doar administratorul):</p>
<ul>
<li>${b("Copia datelor (dreptul de acces)")}: ${b("Descărcați datele (JSON)")} conține tot ce știe panoul despre pacient.</li>
<li>${b("Anonimizare (dreptul la ștergere)")}: numele, CNP-ul, datele de contact, notele nemedicale și documentele încărcate se șterg definitiv; fișa devine „Pacient anonimizat #număr”. Rămân doar ce cere legea să păstrați: facturile și evidența medicală. Ca siguranță, tastați numărul fișei.</li>
<li>${b("Cine a deschis sau a modificat fișa")}: jurnalul accesului la fișă.</li>
</ul>
${img("pacient-gdpr", "Fila GDPR a pacientului.")}
${atentie("Anonimizarea nu se poate anula.")}`,
});

export const jurnal = () => ({
  titlu: "Jurnalul: cine ce a făcut",
  html: `
<p>${b("Jurnal")} arată fiecare acțiune din panou: intrări, fișe deschise, programări, facturi, acorduri, exporturi, setări. Filtrați după persoană, acțiune, pacient (numărul fișei) și perioadă; ${b("Export Excel (CSV)")} pentru arhivă sau control.</p>
${img("jurnal", "Jurnalul acțiunilor.")}`,
});

export const siteul = () => ({
  titlu: "Site-ul: ce se schimbă din panou",
  html: `
<p>Site-ul dentalarena.ro citește datele din panou la fiecare vizită, deci ce schimbați se vede imediat:</p>
${tabel(["Pe site", "Se schimbă din"], [
  ["Prețurile, serviciile, motivele de programare și durata lor", "Servicii și prețuri"],
  ["Medicii, poza, textul, cine apare la fiecare serviciu, programul lor", "Echipa"],
  ["Concediile, cursurile, zilele libere (orele dispar de pe site)", "Absențe și zile libere"],
  ["Fotografiile", "Fotografii site"],
  ["Adresele, telefoanele, programul clinicilor; firma fiecărei clinici; pagina de Facebook; programarea online; chatul", "Setări (VITIM)"],
])}
${img("site-acasa", "Prima pagină: la fiecare clinică, prima oră liberă.")}
<p>Pagina ${b("Programare")} de pe site face programări direct în calendar (vezi capitolul despre programările făcute de pacienți); cine nu găsește o oră lasă o cerere. Chatul trimite cereri sau face programări (după setare).</p>
${img("site-programare", "Pagina de programare de pe site.", { mic: true })}`,
});

export const intretinere = () => ({
  titlu: "Întreținere: Cron, actualizări, copii de siguranță",
  html: `
<ul>
<li><strong>Cron Job (obligatoriu)</strong>: în cPanel → Cron Jobs, la fiecare 5 minute: <span class="adresa-inline">php /home/CONT/dentalarena/cron.php</span>. El trimite mesajele, reamintirile, programul zilei al medicilor, urările, rechemările și rezumatul pentru administrator la timp. Fără el, acestea pleacă doar când cineva deschide panoul.</li>
<li><strong>Actualizări</strong>: din ${b("Setări")} → ${b("Actualizare")} (vezi mai jos).</li>
<li><strong>Copii de siguranță</strong>: în cPanel → Backup, săptămânal: baza de date și folderul dentalarena/storage (documentele pacienților). Păstrați o copie și în afara găzduirii.</li>
<li><strong>Parolele</strong>: fiecare om are contul lui; nu folosiți conturi comune. Dezactivați imediat contul cuiva care pleacă.</li>
</ul>
<h3>Actualizarea site-ului din panou</h3>
<p>Orice modificare a site-ului sau a panoului vine ca o arhivă ZIP (dentalarena-php.zip). O instalați din ${b("Setări")} → ${b("Actualizare")}:</p>
${pasi([
  "Faceți o copie a bazei de date din cPanel → Backup (recomandat).",
  `Alegeți arhiva și apăsați ${b("Încărcați și verificați")}. Se încarcă pe bucăți, deci poate fi oricât de mare.`,
  `Verificați versiunea nouă, scrieți parola și apăsați ${b("Instalați actualizarea")}. Durează de obicei sub un minut.`,
  `Dacă ceva nu e în regulă, la ${b("Copii de siguranță")} apăsați ${b("Puneți înapoi")} pentru versiunea de dinainte.`,
])}
${img("actualizare", "Pagina Actualizare, cu un pachet încărcat și verificat.")}
${sfat("Actualizarea nu atinge setările, documentele pacienților, fotografiile încărcate și datele; tabelele noi se adaugă singure. Panoul acceptă doar arhive cu structura pachetului site-ului.")}
${sfat("Ghidul tehnic complet (instalare, e-mail, WhatsApp, AI) e în fișierul CITESTE-MA.md din arhivă.")}`,
});

export const intrebari = (rol) => ({
  titlu: "Întrebări frecvente",
  html: `
<dl class="faq">
<dt>Nu pot intra în panou.</dt><dd>Verificați e-mailul și parola (atenție la majuscule). După 10 încercări greșite așteptați 15 minute. Dacă tot nu merge, VITIM vă pune o parolă nouă de început.</dd>
<dt>Nu văd o clinică sau un pacient.</dt><dd>Contul vede doar clinicile bifate pe el. Pacienții altei clinici nu apar.</dd>
${rol === "medic" ? `<dt>Dictarea nu pornește.</dt><dd>Folosiți Chrome, Edge sau Safari, pe adresa cu https, și permiteți accesul la microfon când browserul îl cere.</dd>
<dt>Nu primesc programul zilei pe WhatsApp.</dt><dd>În Echipa → profilul dumneavoastră se verifică canalul, mobilul și ora, iar în Setări → Mesaje șablonul WhatsApp aprobat. Până la aprobare primiți SMS.</dd>
<dt>Plec în concediu. Ce fac?</dt><dd>Puneți concediul la Absențe și zile libere. Orele dispar de pe site, iar recepția vede programările de mutat.</dd>` : rol === "vitim" ? `<dt>Administratorul nu vede Setările.</dt><dd>Așa trebuie: cât timp există un cont VITIM activ, Setările și Utilizatorii sunt doar ale lui VITIM. Dacă se dezactivează contul VITIM, administratorul le vede din nou.</dd>
<dt>Pe site nu apar ore libere.</dt><dd>Verificați: programarea online e pornită (Setări → Programări online), serviciile au bifa „Programare online”, medicii au program la Echipa și bifa „primește programări de pe site”, iar clinica nu are orele închise în ziua respectivă.</dd>
<dt>Mesajele nu pleacă.</dt><dd>Setări → Mesaje: modul trebuie să fie „Trimitere reală”, conturile completate, iar Cron Job-ul să ruleze la 5 minute. Pagina Mesaje arată de ce a eșuat fiecare.</dd>` : `<dt>Pacientul spune că n-a primit confirmarea.</dt><dd>Verificați în fișă telefonul, canalul (SMS / WhatsApp / fără mesaje) și fila Mesaje: acolo vedeți dacă a plecat, s-a livrat sau a eșuat. Un mesaj eșuat se poate reîncerca din pagina Mesaje.</dd>
<dt>Am mutat o programare din greșeală.</dt><dd>Apăsați imediat „Anulați” jos în calendar: pacientul nu primește nimic. Dacă a trecut, mutați-o înapoi; pacientul primește ora corectă.</dd>
<dt>Tableta nu deschide pagina de semnare.</dt><dd>Apare „Tableta nu este asociată”: VITIM o asociază din Setări → Tablete de semnare. Dacă pacientul scrie de mai multe ori un cod greșit, tableta așteaptă câteva minute.</dd>`}
<dt>Lucrez de pe telefon. Merge?</dt><dd>Da. Panoul se adaptează la telefon; meniul se deschide din colțul de sus.</dd>
<dt>Cine vede ce am făcut?</dt><dd>Fiecare acțiune importantă (fișe deschise, CNP afișat, modificări, exporturi) e trecută în jurnal, pe care îl vede administratorul.</dd>
</dl>`,
});

// ── Stage 6: implants, VITIM, online booking settings ────────────────────────────────────

export const implanturi = () => ({
  titlu: "Implanturile: etapele fiecărui caz",
  html: `
<p>Pe fila ${b("Fișa")}, chenarul ${b("Implanturi")} urmărește fiecare caz, de la plan la lucrarea finală și controalele anuale, ca niciun pacient să nu fie uitat între etape.</p>
${pasi([
  `${b("Caz nou")}: dinții (în numerotarea FDI, de exemplu 36 sau 36, 46), sistemul de implant, medicul și observații. ${b("Adăugați cazul")}.`,
  `După fiecare etapă, alegeți-o în listă (de obicei e deja aleasă etapa următoare), data și apăsați ${b("Notați etapa")}.`,
])}
${img("fisa-implant", "Un caz de implant, cu etapele lui.")}
${tabel(["Etapa", "Pasul următor, de obicei"], [
  ["Planificat", "Inserarea."],
  ["Implant inserat", "Descoperirea, după aproximativ 3 luni (osteointegrare)."],
  ["Descoperit, bont de vindecare", "Amprenta, după aproximativ 3 săptămâni."],
  ["Amprentă luată", "Lucrarea finală, după aproximativ 2 săptămâni."],
  ["Lucrarea finală pusă", "Controlul, peste un an."],
  ["Control anual", "Următorul control, peste un an; sau Încheiat."],
])}
<p>Meniul ${b("Implanturi")} arată toate cazurile în curs (pentru un medic, implicit ale lui), cu etapa de acum, ce urmează și când. Cele cu data trecută sunt roșii: sunați pacientul.</p>
${img("implanturi", "Toate cazurile de implant în curs.")}`,
});

export const vitimAdmin = () => ({
  titlu: "Suportul tehnic (VITIM) și ce primiți de la el",
  html: `
<p>Configurarea panoului o face <strong>VITIM</strong>, cu contul lui de suport tehnic: setările (firma, clinicile, mesajele, AI, chatul, programările online, tabletele, actualizările) și conturile echipei. De aceea, ca administrator, nu vedeți în meniu ${b("Setări")} și ${b("Utilizatori")}. Restul panoului îl vedeți tot.</p>
<h3>Ce a schimbat VITIM</h3>
<ul>
<li>Pe pagina ${b("Azi")}, un chenar galben arată fiecare modificare făcută de VITIM: ce setare, ce valoare era și ce a devenit. Apăsați ${b("Am văzut")} după ce le-ați citit.</li>
<li>Primiți și un <strong>e-mail cu rezumatul</strong>, după ce VITIM a terminat (10 minute fără alte modificări): unul pentru o sesiune de lucru, nu câte unul la fiecare clic.</li>
<li>Toate rămân și în ${b("Jurnal")}.</li>
</ul>
${img("azi-vitim", "Pe pagina Azi: ce a schimbat VITIM.")}
${sfat("Pentru un cont nou, o parolă uitată, o setare de mesaje sau o actualizare, scrieți-i lui VITIM. Partea financiară (facturi, încasări) o pornește tot VITIM, la începutul etapei a doua.")}`,
});

export const rolVitim = () => ({
  titlu: "Rolul VITIM în panou",
  html: `
<p>Contul <strong>Suport tehnic (VITIM)</strong> vede tot panoul și are, în plus, ${b("Setări")} și ${b("Utilizatori")}. Administratorul clinicii nu le mai vede cât timp există un cont VITIM activ.</p>
${tabel(["Doar VITIM", "Unde"], [
  ["Clinicile (adresă, ore pe zile, cabinete, firma fiecăreia), pagina de Facebook, textele acordurilor, modulele", "Setări"],
  ["Conturile echipei, rolurile, parolele de început, sesiunile", "Utilizatori"],
  ["SMS, WhatsApp, e-mail: conturile, textele, modul de probă", "Setări → Mesaje"],
  ["Cheia Anthropic, modelul AI", "Setări → Asistentul AI"],
  ["Programarea online pe site", "Setări → Programări online"],
  ["Chatul de pe site", "Setări → Chatul de pe site"],
  ["Tabletele de semnare", "Setări → Tablete de semnare"],
  ["Actualizarea site-ului dintr-o arhivă ZIP", "Setări → Actualizare"],
])}
<h3>Administratorul este anunțat</h3>
<p>Tot ce schimbați în setări și conturi se scrie în jurnal cu valoarea veche și cea nouă (fără parole sau chei) și ajunge la administrator: pe pagina lui ${b("Azi")} și într-un e-mail de rezumat, trimis după 10 minute fără alte modificări.</p>
${img("azi-vitim", "Ce vede administratorul pe pagina Azi.")}
${atentie("Partea financiară e oprită în perioada de probă. O porniți din Setări → Module → „Partea financiară”, când clinica trece la etapa a doua.")}`,
});

export const setariProgramari = () => ({
  titlu: "Programările online",
  html: `
<p>${b("Setări")} → ${b("Programări online")}: cum își aleg pacienții ora pe site și în chat.</p>
${img("setari-programari", "Setările programărilor online, motivele de pe site, primele ore libere și programul medicilor.")}
${tabel(["Setarea", "Ce face"], [
  ["Pacienții își aleg singuri ora pe site", "Pornit: pagina Programare arată orele libere reale. Oprit: pacientul lasă o cerere și îl sunați."],
  ["Orele se arată din … în …", "Grila orelor: la 15 minute, 9:00, 9:15, 9:30…"],
  ["Cel mai devreme, față de acum", "Ca recepția și medicul să afle din timp (implicit 2 ore)."],
  ["Cu câte zile înainte", "Cât de departe în viitor se poate programa (implicit 30)."],
  ["Pauză între programări", "Timp pentru curățenie și sterilizare după fiecare pacient."],
  ["Durata, când serviciul nu are una", "Pentru motivele fără durată."],
  ["Anulare din link cu cel puțin … ore înainte", "După aceea, pacientul anulează doar la telefon."],
  ["Dimineața se termină la", "Pentru împărțirea orelor în „Dimineața” și „După-amiaza”."],
])}
<p>În pagină se văd și <strong>motivele de pe site</strong> (se aleg la Servicii și prețuri → serviciu → „Programare online”), <strong>primele ore libere</strong> calculate acum și <strong>programul fiecărui medic</strong>.</p>
${sfat("Orele libere vin din programul medicilor (Echipa), minus programările, pauzele, absențele, orele în care clinica e închisă și sărbătorile legale. Un medic fără program sau fără bifa „primește programări de pe site” nu apare.")}`,
});

export const setariChat = () => ({
  titlu: "Chatul de pe site",
  html: `
<p>${b("Setări")} → ${b("Chatul de pe site")}: pornit/oprit, modelul AI, modul programărilor (<strong>cerere</strong>, confirmată de recepție la telefon, sau <strong>direct în calendar</strong>, după un cod primit prin SMS, care cere SMS-urile pornite), limita zilnică de conversații și după câte zile se șterg. Durata programărilor, cât de devreme și cu câte zile înainte se iau din Programări online.</p>
${img("setari-chat", "Setările chatului.")}
${atentie("Chatul propune ore doar pentru medicii care au program completat (Echipa → medic → „Unde și când lucrează”). Cheia API Anthropic trebuie salvată înainte, în Setări → Asistentul AI.")}`,
});
