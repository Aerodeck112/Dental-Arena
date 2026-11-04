# Conturi demonstrative (Cabinet, `/crm`)

Create de `npm run db:seed` (`prisma/seed.ts`). Sunt doar pentru dezvoltare: adresele sunt
substituente, iar parola este aceeași pentru toate conturile.

- **Adresa de autentificare:** http://localhost:3000/crm/login
- **Parola:** `parola-demo-2026` (sau valoarea din `SEED_PASSWORD`, dacă este setată în `.env`)
- În producție (`NODE_ENV=production`) fiecare cont trebuie să-și schimbe parola la prima autentificare.

| Rol | E-mail | Observații |
|---|---|---|
| ADMIN | `admin@dentalarena.ro` | Administrator Clinică; vede toate modulele, inclusiv Setări, Audit și GDPR |
| RECEPTIE | `receptie.cristesti@dentalarena.ro` | Recepție Cristești; clinica implicită: Cristești |
| RECEPTIE | `receptie.ludus@dentalarena.ro` | Recepție Luduș; clinica implicită: Luduș |
| MEDIC | `andrei.marcoci@dentalarena.ro` | Dr. Andrei Marcoci |
| MEDIC | `mihail.masca@dentalarena.ro` | Dr. Mihail Dan Mașca (planul „Plan implant 36” al pacientei Maria Suciu) |
| MEDIC | `paul.bologa@dentalarena.ro` | Dr. Paul Bologa |
| MEDIC | `victoria.podar@dentalarena.ro` | Dr. Victoria-Ana Podar |
| MEDIC | `anamaria.fertea@dentalarena.ro` | Dr. Ana-Maria Fertea (concediu demonstrativ peste 10 zile) |

## Cum se recreează

```bash
cp .env.example .env          # o singură dată; înlocuiți AUTH_SECRET și PII_ENCRYPTION_KEY
npm run db:migrate            # prisma migrate dev
npm run db:seed               # date de bază + date demonstrative
```

- Seed-ul de bază poate fi rulat de câte ori doriți: nu creează duplicate și nu suprascrie ce s-a modificat din CRM.
- Datele demonstrative (46 de pacienți, programări pe ultimele 60 de zile, azi și următoarele 14 zile, cereri, facturi, rechemări) se creează doar dacă tabelul de pacienți este gol și `SEED_DEMO` nu este `0`.
- `npm run db:reset` (`prisma migrate reset --force && prisma db seed`) golește baza, aplică migrările și rulează din nou seed-ul. Prisma 7 nu mai rulează seed-ul automat după `migrate reset`, de aceea scriptul îl apelează explicit.
- Toate datele clinice sunt fictive; telefoanele folosesc intervalul nealocat `+40700000xxx`, iar e-mailurile domeniul `example.com`.
