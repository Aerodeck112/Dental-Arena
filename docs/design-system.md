# Dental Arena: design system (final)

Version 1, 5 October 2026. This covers the public website and the staff CRM (called "Cabinet"). Both run in one Next.js App Router project with Tailwind CSS v4.

Sources:
- the text snapshot of the current site, in `research/pages/*.txt`
- the original media, in `research/media/*`
- three competing design plans: A "Filet", B "Canapeaua galbenă" and C "Aer"

The rules in this file override the three plans wherever they disagree.

---

## 0. How this system was chosen

### 0.1 Scores (1–10)

| Criterion | A. Filet (calm clinical craft) | B. Canapeaua galbenă (the yellow sofa) | C. Aer (breathe easy) |
|---|---|---|---|
| Fit to brand and logo | **9.** Forum echoes the Trajan-style wordmark. Mint #7DC9A1 and slate #5C6765 were sampled correctly; I re-sampled them and got (125,201,161) and (92,103,101). The signature device is built from the logo's own implant screw. | **7.** Mint and slate are kept, but mustard is promoted to a core colour. Brygada 1918 is warmer and further from the wordmark. Mint pill buttons soften the mark's precision. | **7.** Exact mint, the sign green and Forum are all right. But frosted glass, a feathered hero and blur-on-load come from no part of the brand, and a blue "sosit" status is off-palette. |
| Reassurance for anxious patients | **7.** The clinic's own promise is the headline, there are factual inhalosedare points, and live free slots for both clinics remove uncertainty. Slightly cool and engineered. | **10.** Asks "how do you feel about the dentist?", answers in the clinic's words, and passes that answer to the doctor's calendar. Adds a "Mă doare acum" branch and a callback option. | **7.** "Respiri ușor" is a kind headline and the breathing exercise is thoughtful. The hero frost, though, is atmosphere rather than information. |
| Distinctiveness against the AI-default traits | **8.** No eyebrows, sentence case, radius set by object type, light only. The two clinics split on the logo's axis is specific to this client. The hero is still text left, photo right. | **8.** The feelings question belongs to no other dental site. Pills, 20–24px radii and soft panels lean toward the SaaS-card softness of trait 4. | **5.** Glassmorphism, blur-to-sharp on load and a feathered photo edge are current trend defaults. The thread device duplicates A. |
| Legibility for older patients | **8.** Red Hat Text at 18/29 with an unslashed zero and tabular figures. Forum is never used below 24px. Formal register. 48–56px targets. | **8.** Atkinson Hyperlegible Next and a 16px public minimum are excellent. But its slashed zero shows up in every public price and time ("2.2ØØ lei"; I checked the font and it has no plain-zero alternate). | **7.** Atkinson with 56px targets is good. Text set on frosted glass over a photo, and thin Forum figures for slot times, are weak points. |
| Adapting to a dense staff CRM | **9.** The most complete module set. Light shell. The thread doubles as the implant notation in the odontogram. Statuses use fill, bar, label and icon together. | **7.** The density-token override is the best engineering idea of the three. But statuses are merged (sosit with în cabinet, anulat with neprezentat), and the dark sidebar edges toward trait 2. | **8.** Detailed calendar and odontogram states, an "Ambele" clinic switch, and a sentence summary instead of KPI tiles. Hurt by the extra blue status. |
| **Total** | **41** | **40** | **34** |

### 0.2 Verdict

**A "Filet" wins, and gets two large grafts from B.**

A and B are almost tied. What separates them is that A's strengths are structural, while B's strength is one idea that can be moved:
- A's strengths are a brand-true type pairing, colours sampled from the logo, a complete CRM model, and a signature taken from the mark. None of these can be bolted onto another plan.
- B's best idea, asking how the patient feels and carrying the answer into the CRM, transplants cleanly into A without a second visual motif.

The final system is therefore A's system, with B's comfort question as its main feature, plus B's density mechanism and a handful of fixes from C.

### 0.3 What was grafted, and from where

| From | What | Where it lives now |
|---|---|---|
| B | **The comfort question**: „Cum vă simțiți când vă gândiți la dentist?” Three answers, a reply in the clinic's words, then the answer travels to booking and to the CRM. | Home section 2, booking step 3, and in the CRM as calendar flags, a patient-file tag and a note (§6.4, §6.7, §6.8) |
| B | **Mustard is a semantic colour, not decoration.** It always means "this person has asked for gentleness". It never appears on CTAs, badges or decoration. | §3.4 |
| B | **The density mechanism.** The CRM layout sets `data-density="compact"`, which overrides the same type and control tokens, so shared components shrink without being forked. | §5.3 |
| B | Booking branches: "Am o durere acum" immediately shows the phone numbers, and „Prefer să mă sunați” creates a callback request. | §6.7 |
| B | Every price on the site is rendered from the CRM price list, and each service has one "representative" price for the home index. | §6.4, §13 |
| B | A Muștar pal note on service pages: „Vă e teamă?” | §6.5 |
| B | A summary row in booking flashes Mentă pal when its value changes. | §8 |
| C | „Pentru cine?” (myself or my child) moves out of the visit reasons and into the patient-details step. | §6.7 |
| C | The clinic switch in the CRM offers Cristești, Luduș and **Ambele** (both). | §6.8 |
| C | Copy fixes found in the current site: the home page swaps the texts of "Fără frică" and "Fără durere"; English leftovers; menu and page names that do not match. | §12.6 |
| C | Accordion „Întrebări” on service pages, used only with answers the clinic has approved. | §10 |

**Considered and rejected:**
- C's frosted glass, blur-to-sharp load effect and feathered photo edge: trend defaults.
- C's breathing exercise: a second motif, with health claims that would need clinical sign-off.
- C's "Soare" yellow as a time signal: it would clash with mustard's comfort meaning.
- C's blue "sosit" status: off-palette.
- B's slate sidebar: dark chrome is too close to trait 2. The CRM shell stays light.
- B's pill-shaped buttons: radius follows object type instead.
- B's informal "tu" voice: older audience (see §12).
- Atkinson Hyperlegible Next: it has a slashed zero and no alternate glyph (I verified the font's glyph list).
- Brygada 1918: further from the wordmark than Forum.

### 0.4 Fact corrections all three plans needed

- **„la 1 km de Târgu Mureș” appears nowhere on the current site.** Every plan used it. The site only says "Locație în apropiere de Targu Mures" (`servicii.txt`). Use **„lângă Târgu Mureș”** until the clinic confirms a distance.
- **„de peste 15 ani”** is safe: the 15-year anniversary ran in July–August 2024. Write „din 2009” only once the clinic confirms the founding year.
- **Dr. Podar's photo is not a portrait.** The site uses `Untitled-design-2024-05-29T130321.118.png`, which is the stock acrylic implant model. She gets a monogram plate (§9.3).
- **Dr. Mașca's portrait is only 600×557 px** (`Untitled-design-2024-05-27T102139.723.png`). That is enough for the team row (about 240px wide at 2×), but not for a large photo on his profile page. Ask the clinic for the original file.
- **„100% sigură”** (pedodonție page) becomes **„sigură”**. Never promise 100% in a medical context.

---

## 1. Subject, audience, job

- **Subject.** Dental Arena is a family dental clinic with two sites in Mureș county:
  - Cristești: str. Principală 536J/1, near Târgu Mureș, tel. 0265 326 316
  - Luduș: str. Gheorghe Barițiu nr. 6, tel. 0365 430 125
  - Team: five doctors.
  - Services: 10, including inhalosedare (laughing-gas conscious sedation, 150 lei / oră), children's dentistry and implants.
- **Audience.** Families and adults from small towns and villages, many over 50, many afraid of pain. They often book for a child, and they often prefer to phone.
- **Primary job.** Get a consultation booked, online in four steps or by calling the right clinic.
- **Secondary jobs:**
  - reassure: fear, pain and price are answered plainly
  - show the real doctors and rooms
- **The CRM's job.** Let reception and doctors run both clinics from one dense, calm tool: today's agenda, calendar, patient files, treatment plans, payments and recalls. The CRM is also the single source of truth for the site's hours, doctors, prices and free slots.

## 2. Principles

1. **The logo is the system.** Mint and slate are sampled from the mark. Forum echoes the inscriptional wordmark. The only graphic device, the thread (*filetul*), is the logo's implant screw. Nothing decorative comes from anywhere else.
2. **Calm, then precise.** Large quiet type and real rooms reassure; tabular figures and exact prices show precision. Engineering is felt, never shown: no screw illustrations, no surgical imagery in the first screen.
3. **Ask, then remember.** The site asks once how the patient feels. The clinic sees the answer before the patient walks in. Mustard is the colour of that promise.
4. **Two clinics, one axis.** Wherever Cristești and Luduș appear together, they split exactly on the page's centre axis, the way DENTAL and ARENA sit on either side of the implant in the logo.
5. **One system, two densities.** The site breathes (18px text, 48–56px targets). The CRM packs tight (14px base, 32–40px controls). The tokens, fonts, colour meanings and components are the same.

---

## 3. Colour

### 3.1 Brand primitives (fixed, never themed)

| Name | Hex | Origin, and what it is for |
|---|---|---|
| **Mentă** (logo mint) | `#7DC9A1` | Sampled from the logo mark. Used for the mark, the filled thread bands, selected fills and the Sosit status. **Never used for text** (1.96:1 on white). Text on it is always dark (Titan in light mode, `#13241D` in dark mode). |
| **Ardezie** (wordmark slate) | `#5C6765` | Sampled from the wordmark and its hairline. Used for the logo wordmark, secondary text in light mode, and the footer background. |
| **Muștar** (the waiting-room sofa) | `#E0AC2B` | Taken from the yellow sofa and gerberas in the waiting room (`Picture2-1.jpg`, `438712305…jpg`). **Semantic only**: it marks a comfort need (see §3.4). Never decorative, never a CTA. |

Logo files always use Mentă `#7DC9A1` for the mark and Ardezie `#5C6765` for the wordmark. Do not change either.

### 3.2 Semantic roles (light and dark)

Components use **only** these role tokens. Each one swaps value in dark mode. The names are Romanian without diacritics, because they become CSS identifiers.

| Token | Light | Dark | Role |
|---|---|---|---|
| `fundal` | `#F4F7F5` Zirconiu | `#1B2422` | Page ground. A cool ceramic white: not cream, not #FFF. |
| `suprafata` | `#FFFFFF` Alb | `#232D2B` | Raised surfaces: panels, inputs, slot buttons, CRM work panes. |
| `adancit` | `#EEF2F0` Ceață | `#2C3734` | Recessed surfaces: Finalizat blocks, table zebra, disabled fills. |
| `cerneala` | `#252E2C` Titan | `#E6EDEA` | Main text, outlines on selected controls, the current thread band. A slate from the brand, not a tinted #111. |
| `discret` | `#5C6765` Ardezie | `#A6B3AF` | Secondary text, captions, breadcrumbs, the dashed edge of Programat. |
| `actiune` | `#1F6B4C` Verde | `#7DC9A1` | Primary button fill, the CRM now-line, the Confirmat bar. |
| `actiune-apasat` | `#185A3F` | `#96D6B4` | Primary button hover and pressed. |
| `pe-actiune` | `#FFFFFF` | `#13241D` | Label on a primary button. |
| `link` | `#1F6B4C` | `#8FD6B1` | Links (always underlined in running text) and the active nav item. |
| `focus` | `#1F6B4C` | `#8FD6B1` | 2px focus outline with a 2px offset. |
| `menta` | `#7DC9A1` | `#7DC9A1` | The mark, filled thread bands, selected slot fill, Sosit fill. |
| `pe-menta` | `#252E2C` | `#13241D` | Text on any Mentă or Muștar fill. |
| `menta-pal` | `#E4F3EA` | `#1F3B2F` | Selected panels, the closing booking band, Confirmat fill, info notes. |
| `linie` | `#D3DDD9` | `#35423F` | Dividers that carry data: price leaders, table rows, the clinic split. **Never a section separator.** |
| `linie-control` | `#7E8C88` | `#7C8C87` | Borders of inputs, slot buttons, checkboxes and unfilled thread bands. At least 3:1 everywhere (see §11). |
| `mustar` | `#E0AC2B` | `#E0AC2B` | The comfort dot, and the fill of a chosen „Am puține emoții” or „Mi-e frică” answer. |
| `mustar-pal` | `#FBEFC9` | `#3B321A` | The comfort reply panel, the „Vă e teamă?” note, and the patient's own words in the CRM. |
| `mustar-text` | `#7A5600` | `#F2C862` | Text of comfort tags. |
| `carmin` | `#B42318` | `#F0877D` | Form errors, medical alerts (allergies, anticoagulants), the Neprezentat label and bar. |
| `carmin-pal` | `#FBE9E7` | `#3F2522` | The Neprezentat fill, the background of an error summary. |
| `subsol` | `#5C6765` | `#232D2B` | Footer ground. |
| `pe-subsol` | `#FFFFFF` | `#E6EDEA` | All footer text and the footer focus ring. Use one weight only; no 70%-white text. |

**When dark mode applies:**
- **Site:** dark mode follows `prefers-color-scheme`.
- **CRM:** Setări → Aspect offers Sistem, Luminos and Întunecat, stored per user as `data-theme` on `<html>`.

**How dark mode stays clear of trait 2 (a near-black ground with an acid-green accent):**
- The ground is a deep green-slate taken from Titan, not `#0B0B0B`.
- The accent is the logo's pastel mint, not an acid green.
- Dark mode is a viewer preference, never the brand's main look.

In dark mode the logo uses the reversed lockup: a white wordmark with the Mentă mark. Popovers in dark mode get a 1px `linie` border, because shadows barely show.

### 3.3 CRM appointment statuses

There are six statuses, exactly as specified. Every status is coded **by fill, edge, label and icon**, never by colour alone. The edge style (dashed, solid bar, none, struck through) carries the information even in greyscale.

| Status | Means | Light: fill / edge / text | Dark: fill / edge / text | Icon | Pattern |
|---|---|---|---|---|---|
| **Programat** | Booked: online, by phone or at reception. Not yet confirmed by reception. | `suprafata` #FFF, 1.5px **dashed** `discret` #5C6765 border, `cerneala` text | #232D2B, dashed #A6B3AF, #E6EDEA | clock outline | dashed = not yet certain |
| **Confirmat** | Reception has confirmed it (call or SMS). | `menta-pal` #E4F3EA, **4px solid bar** `actiune` #1F6B4C, `cerneala` | #1F3B2F, bar #7DC9A1, #E6EDEA | check | solid bar |
| **Sosit** | The patient is in the clinic. | **solid** `menta` #7DC9A1, bar `actiune`, `pe-menta` #252E2C | #7DC9A1, bar #96D6B4, #13241D | door-enter | the only fully filled block, readable from across the room |
| **Finalizat** | The visit is done. | `adancit` #EEF2F0, no bar, `discret` text | #2C3734, no bar, #A6B3AF | double check | recessed and quiet |
| **Anulat** | Cancelled in advance; the slot is free again. | transparent on `fundal`, 1px dashed `linie-control` border, `discret` text **struck through** | transparent, dashed #7C8C87, #A6B3AF struck through | circle-slash | strike-through |
| **Neprezentat** | No-show; needs a follow-up call. | `carmin-pal` #FBE9E7, 4px bar `carmin` #B42318, `cerneala` text, label in `carmin` | #3F2522, bar #F0877D, #E6EDEA, label #F0877D | user-x | red bar plus label |

- The CRM shows "în cabinet" (in the chair) as **Sosit** plus a running timer ("în cabinet de 12 min"). It is not a seventh colour.
- Status chips in tables use the same pairs in a pill (`radius-chip`), with icon plus word.
- In calendar blocks under 30 minutes the word is dropped. The icon (with `aria-label`) and the edge pattern stay, and the drawer always shows the word.

### 3.4 Overlays (independent of status)

| Overlay | Look | Source |
|---|---|---|
| **Confort**: „Mi-e frică”, „Emoții”, „Inhalosedare” | An 8px `mustar` dot with a 1px `mustar-text` ring, plus a tag reading „Mi-e frică” in `mustar-text` on `mustar-pal`. Always a word, never a dot alone. | The answer from booking step 3, or what reception enters by hand. |
| **Alertă medicală**: „Alergie: penicilină”, „Anticoagulante” | A tag with a 1.5px `carmin` outline, `carmin` text and an alert icon. In the calendar: an alert icon in the block corner. | Anamneză. |
| **Copil** | A neutral tag in `discret` text with a `linie-control` outline, for example „Copil, 7 ani”. | Patient date of birth or guardian link. |
| **Online** | A neutral tag „Online”. | Appointment source. |

Two rules that never change:
- **Mustard means emotional comfort; red means clinical risk.** They never swap.
- **Count badges** (Cereri online 3) use `cerneala` on `menta-pal`. They are never mustard and never red.

---

## 4. Typography

### 4.1 Families

| Role | Google Fonts name | next/font export | Weights | Why |
|---|---|---|---|---|
| Display ("the inscription") | **Forum** | `Forum` | 400 only | A Roman inscriptional serif whose capitals (D, A, R, N) match the Trajan-style DENTAL ARENA wordmark, with a calm lowercase so headlines can be sentence case. I verified that the file contains ă â î ș ț Ș Ț (comma-below), plus „ ” and the en dash. |
| Text and UI ("the instrument") | **Red Hat Text** | `Red_Hat_Text` | variable 300–700; used at 400, 500 and 600 | A humanist-leaning sans with open apertures and a large x-height. It has the `tnum` feature and an **unslashed zero**, so prices and phone numbers stay calm on the public site, and it holds up at 13px in CRM tables. Romanian coverage verified. |

There is no monospace face anywhere, and no third family. Remove the scaffold's Geist and Geist Mono.

```ts
// src/app/layout.tsx
import { Forum, Red_Hat_Text } from 'next/font/google'

const forum = Forum({ weight: '400', subsets: ['latin', 'latin-ext'], variable: '--font-forum', display: 'swap' })
const redHat = Red_Hat_Text({ subsets: ['latin', 'latin-ext'], variable: '--font-redhat', display: 'swap' })

// <html lang="ro" className={`${forum.variable} ${redHat.variable}`}>
```

`latin-ext` is mandatory, because ș and ț live at U+0218–021B.

### 4.2 Scale

The scale follows the classical sequence from *The Elements of Typographic Style* (12, 13, 14, 16, 17, 18, 21, 24, 28, 36, 48, 60, 72). Sizes are written as size/line-height in px.

**Public site**

| Token | Desktop | Mobile | Family | Use |
|---|---|---|---|---|
| `text-hero` | 72/78 | 48/52 | Forum | The home headline only. At most 3 lines, `text-wrap: balance`. |
| `text-h1` | 60/66 | 36/40 | Forum | Page titles. |
| `text-h2` | 36/42 | 28/33 | Forum | Section headings and the booking question on each step. |
| `text-nume` | 24/30 | 24/30 | Forum | Names of doctors, clinics and price groups. |
| `text-h3` | 21/28 | 21/28 | Red Hat 600 | Panel titles and service names in the index. |
| `text-lead` | 21/33 | 19/30 | Red Hat 400, `discret` | Lead paragraphs, max 52ch. |
| `text-corp` | 18/29 | 18/29 | Red Hat 400, `cerneala` | Body text, max 64ch. |
| `text-control` | 17/24 | 17/24 | Red Hat 500 | Buttons, inputs, chips, nav. |
| `text-mic` | 16/24 | 16/24 | Red Hat 400 | Captions, breadcrumbs, slot day labels. |
| `text-legal` | 14/20 | 14/20 | Red Hat 400 | The legal line in the footer **only**. Nothing else on the public site goes below 16px. |

**CRM** (applied through `data-density="compact"`, see §5.3)

| Token | Size | Family | Use |
|---|---|---|---|
| `text-h1` | 28/32 | Forum | The page title („Marți, 6 octombrie”) and the patient's name. These are the **only** two uses of Forum in the CRM. |
| `text-h3` | 16/22 | Red Hat 600 | Section and panel headings. |
| `text-corp` | 14/20 | Red Hat 400 | UI base, forms. |
| `text-control` | 14/20 | Red Hat 500 | Buttons, tabs, inputs. |
| `text-mic` | 13/18 | Red Hat 400 `tnum` | Tables. |
| `text-micro` | 12/16 | Red Hat 400 or 600 | Calendar blocks (patient name at 600), timestamps, the time gutter. This is the CRM minimum. |

### 4.3 Typographic rules

1. Forum is used only at **24px and above**. Set `font-synthesis: none` (no fake bold or italic). Never all caps. Letter-spacing is 0, or +0.01em at 24–28px.
2. **Sentence case everywhere.** The only capitals in the system are inside the logo artwork („CLINICA STOMATOLOGICA”). There are no eyebrow labels, no tracked-caps labels and no all-caps table headers.
3. Every section opens with its Forum heading; nothing sits above it. Never accent one word of a headline with colour, italic or weight.
4. In running text, emphasis is Red Hat 600, never colour.
5. Every price, time, date, phone number and CRM table uses `font-variant-numeric: tabular-nums lining-nums` (the Tailwind `tabular-nums` utility).
6. Phone numbers are grouped as `0265 326 316` with no-break spaces and never wrap. They link to `tel:+40265326316`. They are **always labelled with their clinic**, because there are two numbers.
7. Prices use `Intl.NumberFormat('ro-RO', { useGrouping: 'always' })`, which gives „2.200 lei” and „15.000 lei”, with a no-break space before „lei”.
   - In columns, prices are right-aligned.
   - Variant pairs stay as „200 / 350 lei”.
   - Starting prices are written „de la 200 lei”.
8. Dates are written in lowercase Romanian: „marți, 7 octombrie”. Short forms are „mar. 7 oct.”. Times are written „09:30”. Ranges use an en dash: „3–6 luni”, „18–24 de luni”.
9. Use comma-below ș ț (U+0219, U+021B) only, never the cedilla forms ş ţ (U+015F, U+0163). Normalise every content import, and add a lint rule.
10. Set `<html lang="ro">`. Use `hyphens: auto` only for body text below 640px. Never hyphenate headings. Everything is left-aligned and ragged-right; never justify text.
11. Join metadata with commas or line breaks. Never write 'A · B'. Never write labels as „Cuvânt — fragment”. Never end link or button text with '→'.
12. Never typeset „DENTAL ARENA” in Forum as a stand-in for the logo. Always use the SVG.

---

## 5. Space, radius, shadow, grid

### 5.1 Tokens

| Group | Token | Value | Notes |
|---|---|---|---|
| Spacing base | `--spacing` | 4px (the Tailwind v4 default) | The site works in multiples of 8. The CRM may use multiples of 4. |
| Rhythm | 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 128 px | | Use only these steps. |
| Section gap | `--spacing-sectiune` | `clamp(4rem, 2.4rem + 6.4vw, 8rem)` | 64 / about 88 / 128 px on phone / tablet / desktop. |
| Side margin | `--spacing-margine` | `clamp(1.25rem, -0.1rem + 5.6vw, 5rem)` | 20 / 40 / 80 px. |
| Gutter | `--spacing-gutter` | 24px (16px in the CRM) | |
| Content width | `--container-continut` | 80rem (1280px) | The CRM is fluid, with no max width. |
| Control height | `--spacing-control` | 48px on the site; 40px in the CRM (M) | The mobile sticky bar is 56px. CRM small controls are 32px. |
| Radius: control | `--radius-control` | 6px | Buttons, inputs, slot buttons, choice buttons. |
| Radius: panel | `--radius-panou` | 12px | Availability panel, booking choice panels, dialogs, comfort reply, CRM panels. |
| Radius: photo | `--radius-foto` | 2px | Photographs are treated as prints. |
| Radius: block | `--radius-bloc` | 4px | CRM calendar blocks and tags. |
| Radius: chip | `--radius-chip` | 9999px | **Only** CRM status chips and count badges. |
| Shadow | `--shadow-float` | light: `0 1px 0 rgb(37 46 44 / .06), 0 16px 40px -16px rgb(37 46 44 / .30)`; dark: `0 1px 0 rgb(0 0 0 / .3), 0 16px 40px -16px rgb(0 0 0 / .7)` plus a 1px `linie` border | **The only shadow.** Used only on things that float: menus, popovers, dialogs, drawers, the mobile sheet and the sticky bar. Panels on the page are flat and have 1px borders. |
| Easing | `--ease-filet` | `cubic-bezier(.2,.7,.2,1)` | Used for all motion. |

### 5.2 `src/app/globals.css` (replaces the scaffold)

```css
@import "tailwindcss";

/* 1. Role values. Components never use raw hex. */
:root {
  color-scheme: light;
  --da-fundal:#F4F7F5; --da-suprafata:#FFFFFF; --da-adancit:#EEF2F0;
  --da-cerneala:#252E2C; --da-discret:#5C6765;
  --da-actiune:#1F6B4C; --da-actiune-apasat:#185A3F; --da-pe-actiune:#FFFFFF;
  --da-link:#1F6B4C; --da-focus:#1F6B4C;
  --da-menta:#7DC9A1; --da-pe-menta:#252E2C; --da-menta-pal:#E4F3EA;
  --da-linie:#D3DDD9; --da-linie-control:#7E8C88;
  --da-mustar:#E0AC2B; --da-mustar-pal:#FBEFC9; --da-mustar-text:#7A5600;
  --da-carmin:#B42318; --da-carmin-pal:#FBE9E7;
  --da-subsol:#5C6765; --da-pe-subsol:#FFFFFF;
  --da-umbra: 0 1px 0 rgb(37 46 44 / .06), 0 16px 40px -16px rgb(37 46 44 / .30);
}
/* Dark values are declared twice: once for an explicit choice, once for the system preference. */
:root[data-theme="dark"] {
  color-scheme: dark;
  --da-fundal:#1B2422; --da-suprafata:#232D2B; --da-adancit:#2C3734;
  --da-cerneala:#E6EDEA; --da-discret:#A6B3AF;
  --da-actiune:#7DC9A1; --da-actiune-apasat:#96D6B4; --da-pe-actiune:#13241D;
  --da-link:#8FD6B1; --da-focus:#8FD6B1;
  --da-menta:#7DC9A1; --da-pe-menta:#13241D; --da-menta-pal:#1F3B2F;
  --da-linie:#35423F; --da-linie-control:#7C8C87;
  --da-mustar:#E0AC2B; --da-mustar-pal:#3B321A; --da-mustar-text:#F2C862;
  --da-carmin:#F0877D; --da-carmin-pal:#3F2522;
  --da-subsol:#232D2B; --da-pe-subsol:#E6EDEA;
  --da-umbra: 0 1px 0 rgb(0 0 0 / .3), 0 16px 40px -16px rgb(0 0 0 / .7);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* same declarations as :root[data-theme="dark"] */ }
}

/* 2. Colour and font utilities. These are "inline" because they reference runtime variables. */
@theme inline {
  --color-*: initial;               /* drop Tailwind's default palette: no off-brand colours */
  --color-white:#FFFFFF;
  --color-fundal:var(--da-fundal); --color-suprafata:var(--da-suprafata); --color-adancit:var(--da-adancit);
  --color-cerneala:var(--da-cerneala); --color-discret:var(--da-discret);
  --color-actiune:var(--da-actiune); --color-actiune-apasat:var(--da-actiune-apasat); --color-pe-actiune:var(--da-pe-actiune);
  --color-link:var(--da-link); --color-focus:var(--da-focus);
  --color-menta:var(--da-menta); --color-pe-menta:var(--da-pe-menta); --color-menta-pal:var(--da-menta-pal);
  --color-linie:var(--da-linie); --color-linie-control:var(--da-linie-control);
  --color-mustar:var(--da-mustar); --color-mustar-pal:var(--da-mustar-pal); --color-mustar-text:var(--da-mustar-text);
  --color-carmin:var(--da-carmin); --color-carmin-pal:var(--da-carmin-pal);
  --color-subsol:var(--da-subsol); --color-pe-subsol:var(--da-pe-subsol);
  --shadow-float:var(--da-umbra);
  --font-display: var(--font-forum), "Times New Roman", serif;
  --font-sans: var(--font-redhat), system-ui, sans-serif;
}

/* 3. Size, space and shape tokens. NOT inline, so that [data-density] can override them. */
@theme {
  --text-hero: clamp(3rem, 1.9rem + 3.6vw, 4.5rem);  --text-hero--line-height: 1.08;
  --text-h1: clamp(2.25rem, 1.6rem + 2.6vw, 3.75rem); --text-h1--line-height: 1.1;
  --text-h2: clamp(1.75rem, 1.55rem + 0.8vw, 2.25rem); --text-h2--line-height: 1.17;
  --text-nume: 1.5rem;      --text-nume--line-height: 1.25;
  --text-h3: 1.3125rem;     --text-h3--line-height: 1.333;
  --text-lead: clamp(1.1875rem, 1.13rem + 0.25vw, 1.3125rem); --text-lead--line-height: 1.57;
  --text-corp: 1.125rem;    --text-corp--line-height: 1.6;
  --text-control: 1.0625rem; --text-control--line-height: 1.41;
  --text-mic: 1rem;         --text-mic--line-height: 1.5;
  --text-legal: .875rem;    --text-legal--line-height: 1.43;
  --text-micro: .75rem;     --text-micro--line-height: 1.33;
  --spacing-sectiune: clamp(4rem, 2.4rem + 6.4vw, 8rem);
  --spacing-margine: clamp(1.25rem, -0.1rem + 5.6vw, 5rem);
  --spacing-gutter: 1.5rem;
  --spacing-control: 3rem;
  --container-continut: 80rem;
  --radius-control: 6px; --radius-panou: 12px; --radius-foto: 2px; --radius-bloc: 4px; --radius-chip: 9999px;
  --ease-filet: cubic-bezier(.2,.7,.2,1);
}

/* 4. CRM density (set on the (crm) route-group layout). The same components shrink without forks. */
[data-density="compact"] {
  --text-h1: 1.75rem;      --text-h1--line-height: 1.143;
  --text-h3: 1rem;         --text-h3--line-height: 1.375;
  --text-corp: .875rem;    --text-corp--line-height: 1.43;
  --text-control: .875rem; --text-control--line-height: 1.43;
  --text-mic: .8125rem;    --text-mic--line-height: 1.385;
  --spacing-control: 2.5rem; --spacing-gutter: 1rem; --radius-panou: 8px;
}

/* Base rules read the --da-* variables directly: "inline" theme variables are not guaranteed to be emitted. */
html { font-synthesis: none; }
body { background: var(--da-fundal); color: var(--da-cerneala); font-family: var(--font-redhat), system-ui, sans-serif; }
:focus-visible { outline: 2px solid var(--da-focus); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }
}
```

### 5.3 Density

| | Site | CRM `data-density="compact"` |
|---|---|---|
| Base text | 18/29 | 14/20 |
| Controls | 48px (56px in the mobile sticky bar) | 40px (M) and 32px (S) |
| Table rows | n/a | 36px. A „Confortabil” toggle in Setări switches to 44px for the reception tablet. |
| Calendar | n/a | 15-minute rows at 24px (96px per hour) |
| Spacing rhythm | 8px | 4px |
| Panel radius | 12px | 8px |

---

## 6. Layout

### 6.1 Grid and alignment

**Grid sizes:**
- Desktop: 12 columns, max 1280px, 24px gutters, 80px margins at 1440.
- Tablet: 8 columns, 40px margins.
- Phone: 4 columns, 20px margins.

**Alignment.** Everything is left-aligned and ragged-right; numbers are right-aligned.

**The axis.** The boundary between columns 6 and 7 stands for the implant line in the logo:
- Content about both clinics splits exactly on it: the hero availability panel, the clinics section, the footer and booking step 1.
- Only two things are centred on it: the booking confirmation and the footer lockup.
- Nothing else is centred.

**Sections:**
- Sections are separated by space (`spacing-sectiune`).
- Where the kind of content changes, add a change of surface (`fundal`, `suprafata` or `menta-pal`).
- There are no hairlines between sections.

**Hairlines** (`linie`) exist only where they carry data: price leaders, table rows and the clinic split.

### 6.2 Information architecture

Keep the current slugs, because they hold the site's search rankings. Anything that moves gets a 301 redirect.

- `/` Acasă
- `/servicii`, plus 10 service pages at their current URLs:
  - `/consultatie-profilaxie`
  - `/stomatologie-generala`
  - `/inhalosedare`
  - `/implantologie`
  - `/chirurgie-dento-alveolara`
  - `/protetica-dentara`
  - `/pedodontie`
  - `/ortodontie`
  - `/parodontologie`
  - `/estetica-dentara`
- `/medici` and `/medici/[slug]` (new)
- `/preturi` (new): every price list, grouped by service, with a search field.
- `/clinici/cristesti` and `/clinici/ludus` (new)
- `/despre-noi`, `/contact`, `/programare` (new)
- `/dentist-targu-mures` and `/cabinet-stomatologic-targu-mures` stay as Târgu Mureș landing pages that point to Cristești.
- Legal pages: `/termeni-si-conditii`, `/confidentialitate` (GDPR; the site collects health data), `/cookie-uri`.
- `/15ani` is retired with a 301 to `/despre-noi`.
- `/cabinet/*` holds the CRM, behind authentication, with `noindex`.

### 6.3 Header and footer

```
DESKTOP HEADER (sticky after 1 screen; fundal, no hairline)
+------------------------------------------------------------------------------------------+
| [mark] DENTAL ARENA        Servicii   Medici   Prețuri   Clinici   Despre noi             |
|  compact lockup SVG                                   Sunați v    [ Programați-vă ]       |
+------------------------------------------------------------------------------------------+
  "Sunați" opens a two-row menu (shadow-float):
     Cristești   0265 326 316
     Luduș       0365 430 125
  "Servicii" opens a two-column text list of all 10 services. No icons.

MOBILE HEADER + STICKY BAR (390)
+------------------------------+
| [mark] DENTAL ARENA   Meniu  |
...
+------------------------------+
| [  Sunați  ][Programați-vă ] |  56px, safe-area inset, shadow-float
+------------------------------+
  "Sunați" opens a bottom sheet titled „Ce clinică sunați?” with two 56px rows.

FOOTER (subsol, centred lockup on the axis; everything else on the grid)
+------------------------------------------------------------------------------------------+
|                         [reversed full lockup: white wordmark, Mentă mark]               |
|                          Zâmbete sănătoase pentru o viață fericită.                      |
|  Cristești                                   |  Luduș                                    |
|  str. Principală 536J/1, Cristești, Mureș    |  str. Gheorghe Barițiu nr. 6, Luduș, Mureș|
|  0265 326 316                                |  0365 430 125                             |
|  office@dentalarena.ro      Facebook   Instagram                                         |
|  Servicii  Medici  Prețuri  Clinici  Despre noi  Contact  Programare                     |
|  [ANPC SAL] [ANPC SOL]   Termeni și condiții   Confidențialitate   Setări cookie-uri     |
|  © 2026 Dental Arena (year generated)                                       text-legal   |
+------------------------------------------------------------------------------------------+
```

### 6.4 Home

```
HOME, DESKTOP 1440, first screen
+------------------------------------------------------------------------------------------+
| header                                                                                   |
|                                                                                          |
| Fără durere,                               Forum 72          +-------------------------+ |
| fără frică,                                                  | Picture1.jpg, 4:5 crop  | |
| cu precizie.                                                 | on the hand-over at the | |
|                                                              | reception desk (mint    | |
| Clinică stomatologică în Cristești, lângă Târgu Mureș,       | scrubs = brand mint)    | |
| și în Luduș. Dacă vă e teamă de dentist, putem lucra         | radius-foto 2px         | |
| cu inhalosedare: rămâneți conștient, doar mult mai relaxat.  |                         | |
|                                         text-lead, 52ch      |                         | |
| +------------------------------------------------------------+-------------------------+ |
| | Primele ore libere pentru o consultație                       suprafata, radius 12   | |
| | Cristești                 0265 326 316  |  Luduș                    0365 430 125     | |
| | [mar. 7 oct.][mar. 7 oct.][mie. 8 oct.] |  [mar. 7 oct.][joi 9 oct.][joi 9 oct.]     | |
| | [10:30      ][14:00      ][09:15      ] |  [16:30      ][11:00     ][12:30     ]     | |
| | Toate orele din Cristești               |  Toate orele din Luduș                     | |
| +-----------------------------------------+--------------------------------------------+ |
|                                           ^ page axis = the logo's implant line          |
+------------------------------------------------------------------------------------------+
```
- The panel overlaps the photo's bottom edge by 48px.
- It shows 3 live slots per clinic from the CRM. **No slot is preselected.**
- Clicking a slot opens `/programare` with the reason (Consultație), clinic and time already filled, so the visitor lands on step 3 with two thread bands filled.
- While loading: grey slot outlines, no shimmer.
- If the CRM can't be reached, or there are no slots, the panel shows: „Sunați-ne și vă găsim o oră.” followed by both numbers.

```
HOME, MOBILE 390, first screen
+------------------------------+
| [mark] DENTAL ARENA   Meniu  |
| Fără durere,                 |  Forum 48/52
| fără frică,                  |
| cu precizie.                 |
| Clinică stomatologică în     |  18/29
| Cristești și Luduș...        |
| +--------------------------+ |
| | Primele ore libere       | |
| | [ Cristești | Luduș   ]  | |  segmented, remembers last choice (localStorage)
| | [marți 7 oct.     10:30] | |  full-width 56px rows
| | [marți 7 oct.     14:00] | |
| | [miercuri 8 oct.  09:15] | |
| | Toate orele              | |
| +--------------------------+ |
| [ Picture1.jpg, 4:3 ]        |
+------------------------------+
| [  Sunați  ][Programați-vă ] |  sticky
+------------------------------+
```

**Home, after the hero, in this order:**

1. **The comfort question** (from B, rebuilt for this system). Wireframe:
   ```
   | Cum vă simțiți când vă gândiți la dentist?        Forum 36   +----------------------+ |
   | Răspunsul ne ajută să ne pregătim. Medicul îl                | 438712305…jpg        | |
   | vede înainte să intrați.                                     | waiting room, yellow | |
   | [ N-am emoții ]  [ Am puține emoții ]  [ Mi-e frică ]        | sofa, 3:4            | |
   | +- mustar-pal, radius 12 (opens after a choice) -------+     | (the source of the   | |
   | | Putem lucra sub inhalosedare: rămâneți conștient,    |     |  mustard)            | |
   | | colaborați cu medicul și vă reveniți în 3–5 minute.  |     |                      | |
   | | Se poate folosi și la copii. 150 lei / oră.          |     |                      | |
   | | [ Programați-vă cu inhalosedare ]  Despre inhalosedare|    +----------------------+ |
   | +------------------------------------------------------+                            |
   ```
   - The answers are choice buttons: 56px tall, radius-control, `linie-control` border.
   - When chosen:
     - „N-am emoții” fills Mentă.
     - „Am puține emoții” and „Mi-e frică” fill Muștar.
     - Each also gets a check icon and a 2px `cerneala` border.
   - Replies, in the clinic's own words:
     - „Mi-e frică”: the inhalosedare facts above.
     - „Am puține emoții”: „Spuneți-ne la început ce vă îngrijorează. Medicul vă explică fiecare pas înainte să înceapă.” *(clinic to approve)*
     - „N-am emoții”: „Atunci alegeți direct o oră.”
   - Every reply ends in a single primary button. The button carries the answer through: `/programare?confort=frica`.
   - The choice is remembered in `sessionStorage` and prefills booking step 3.
   - Nothing is preselected on load. Without JS the section shows the three answers as links into booking.
2. **„Medicii”.**
   - Lead: „Respectăm ora programării, iar medicii noștri au acea „mână ușoară” pe care o căutați.” This is from Despre noi, set in the formal voice.
   - Five 4:5 portraits in one row, eye-lines aligned. Name in Forum 24; role in Red Hat 16 `discret`; the link „Programați-vă la Dr. Marcoci”.
   - Phone: horizontal scroll-snap at 72% width per portrait.
3. **„Ce tratăm”.**
   - A two-column text index of the 10 services. Each row: name (Red Hat 600, 21), one plain sentence from the current copy, and one representative price set in the CRM, right-aligned with tabular figures (for example „Implant Neodent 2.200 lei”, „Inhalosedare 150 lei / oră”).
   - No icons, no cards.
   - Link: „Toate prețurile”.
4. **„Copiii”** (pedodonție).
   - The current paragraph, with „100% sigură” changed to „sigură”.
   - Three prices: fluorizare 50 lei / arcadă, sigilare 100 lei, obturație dinte temporar 120 lei.
   - Photo: the beach-mural room, `438716692…jpg`.
5. **„Clinicile”.** Cristești and Luduș split on the axis. Each side has:
   - a photo, the address, the phone number
   - opening hours from the CRM (hidden until the clinic supplies them)
   - „Deschideți în Google Maps”, and a static map image. The Google embed loads only after „Afișați harta”, so no Google cookies are set before consent.
6. **Footer.**

There is no stats band and no „15 ani” big number. „De peste 15 ani” lives as a sentence on Despre noi.

### 6.5 Service page (Implantologie shown; all 10 follow this structure)

```
+------------------------------------------------------------------------------------------+
| header                                                                                   |
| Servicii / Implantologie                                      breadcrumb, text-mic       |
| Implantologie                              Forum 60    +---------------------------+     |
| Dinții lipsă se pot înlocui cu un implant: o piesă     | real clinic photo, 4:3    |     |
| din titan care ține locul rădăcinii.                   | (none until the shoot;    |     |
| [ Programați o consultație ]   Sunați                  |  the layout works without)|     |
|                                                        +---------------------------+     |
| Cum decurge                       cols 1-7    |  Cine vă tratează              cols 9-12 |
|  [band]  Radiografii și planul de tratament   |  [4:5] Dr. Mihail Dan Mașca             |
|  [band]  Inserarea implantului                |  competență în implantologie            |
|  [band]  Vindecare, 3–6 luni                  |  Programați-vă la Dr. Mașca             |
|  [band]  Bontul protetic                      |  +- mustar-pal, radius 12 -----------+  |
|  [apex]  Coroana, puntea sau proteza          |  | Vă e teamă? Intervenția se poate  |  |
|                                               |  | face sub inhalosedare.            |  |
|                                               |  | Despre inhalosedare               |  |
|                                               |  +-----------------------------------+  |
| Prețuri                                               cols 1-8, tabular, right-aligned   |
| Implant Neodent ........................................................ 2.200 lei       |
| Bont protetic drept sau angulat .......................................... 550 lei       |
| Adiție de os, tehnica Khoury ........................................... 3.000 lei       |
| Adiție de os preimplantară ............................................. 1.500 lei       |
| Augmentare osoasă cu plasă de titan .................................... 3.500 lei       |
| Proteză mandibulară pe două implanturi ................................. 9.000 lei       |
| Proteză maxilară pe 4 implanturi ...................................... 15.000 lei       |
| Prețurile sunt orientative. Costul exact îl aflați după consultație și radiografii.      |
| Întrebări (accordion, only with clinic-approved answers)                                 |
| +- menta-pal band ---------------------------------------------------------------------+ |
| | Programați o consultație de implantologie                    [ Alegeți o oră ]       | |
| | Cristești 0265 326 316                    |  Luduș 0365 430 125                      | |
| +--------------------------------------------------------------------------------------+ |
| Vă poate interesa și: Chirurgie dento-alveolară, Protetică dentară                       |
+------------------------------------------------------------------------------------------+
```
- **„Cum decurge”** (the thread steps) appears **only** where the clinic's own copy describes a real sequence:
  - Implantologie.
  - Ortodonție: consultație, aparat, controale și activări, îndepărtare și fluorizare; 18–24 de luni.
  - Inhalosedare: rămâneți conștient, colaborați cu medicul, vă reveniți în 3–5 minute.
  - Every other service gets prose and prices only.
- **„Cine vă tratează”** uses the specialties stated on the current site:
  - Implantologie: Mașca
  - Chirurgie: Fertea
  - Ortodonție: Podar
  - Stomatologie generală: Marcoci, Mașca, Bologa
  - Elsewhere it shows „Echipa” rather than inventing who does what.
- The booking button carries the service through, so booking step 1 opens with the reason already chosen.
- On a phone everything stacks in this order: title, lead, buttons, steps, doctor, the comfort note, prices. The dotted leaders shorten; prices stay right-aligned.

### 6.6 Team

```
/medici, DESKTOP
+------------------------------------------------------------------------------------------+
| Medicii                                                                   Forum 60       |
| Cinci medici, în Cristești și Luduș. Respectăm ora programării.          text-lead       |
|                                                                                          |
| +--------+  +--------+  +--------+  +--------+  +--------+     5 x 4:5, eye-line at 32%  |
| |Marcoci |  | Mașca  |  | Bologa |  | Podar  |  | Fertea |     from the top, fundal field|
| |312167..|  |102139..|  |328740..|  |  VP    |  |431150..|     Podar = monogram plate    |
| +--------+  +--------+  +--------+  +--------+  +--------+                               |
| Dr. Andrei  Dr. Mihail  Dr. Paul    Dr. Victoria Dr. Ana-Maria  Forum 24                 |
| Marcoci     Dan Mașca   Bologa      -Ana Podar   Fertea                                  |
| Stomatologie Stomatologie Stomatologie Ortodonție  Chirurgie     text-mic discret, links  |
| generală    generală,   generală    și ortopedie dento-alveolară to service pages         |
|             implantologie            dento-facială                                       |
| Programați-vă la Dr. Marcoci   (one link each; preselects the doctor in booking step 2)  |
+------------------------------------------------------------------------------------------+
  Phone: one column. The portrait is 4:5 at 100% width, then name, role, link.

/medici/[slug]
+------------------------------------------------------------------------------------------+
| Medici / Dr. Mihail Dan Mașca                                                            |
| +--------------------+    Dr. Mihail Dan Mașca                             Forum 60      |
| | portrait 4:5       |    Medic dentist, stomatologie generală, competență în            |
| | cols 1-4           |    implantologie                                   text-lead     |
| |                    |    Biografia (supplied by the clinic; hidden until it exists)     |
| +--------------------+    Unde lucrează: Cristești, luni și miercuri (from the CRM)      |
|                           Servicii: Implantologie, Stomatologie generală                 |
|                           [ Programați-vă la Dr. Mașca ]   Sunați                        |
+------------------------------------------------------------------------------------------+
```
No stock face is ever substituted for a missing portrait.

### 6.7 Booking wizard (`/programare`)

The wizard has its own minimal header (logo, clinic phone numbers, „Închideți”). It is a genuine sequence, so it is numbered.

| Step | Question (Forum 36) | Content |
|---|---|---|
| 1. Motivul și clinica | „Cu ce vă putem ajuta?” and „La ce clinică veniți?” | **Reasons:** Consultație sau control; Am o durere acum; Igienizare (detartraj); Implant sau lucrare dentară; Aparat dentar; Nu știu sigur. **Clinics:** two panels split on the axis. Cristești, str. Principală 536J/1, lângă Târgu Mureș, with its next free slot. Luduș, str. Gheorghe Barițiu nr. 6, with its next free slot. Choosing „Am o durere acum” pins both phone numbers above the step: „Sunați-ne și găsim cea mai apropiată oră.” |
| 2. Ziua și ora | „Când vă convine?” | **Doctor filter:** „Oricare medic” or a chip with the doctor's photo. **Week strip:** 14 days; days with no slots are disabled. **Slots** grouped under „Dimineața” and „După-amiaza”. **Link:** „Nu găsesc o oră potrivită. Prefer să mă sunați.” This creates a callback request. |
| 3. Cum vă simțiți | „Cum vă simțiți înainte de vizită?” | **Choices:** N-am emoții; Am puține emoții; Mi-e frică. Prefilled from the home question. Note: „Medicul vede răspunsul înainte să intrați.” **Checkbox:** „Aș vrea inhalosedare (150 lei / oră)”. If the answer is emoții or frică, an optional field appears: „Vreți să ne spuneți ce vă îngrijorează?” |
| 4. Datele dumneavoastră | „Cum vă putem contacta?” | **Fields:** Nume și prenume; Telefon (required, `inputmode="tel"`, `autocomplete="tel"`); E-mail (optional, for the confirmation). **„Pentru cine?”:** Pentru mine, or Pentru copilul meu (then the child's first name and age). **Text area:** „Ceva ce ar trebui să știm?” **Consents:** GDPR consent for health data (required, links to Confidențialitate); SMS reminder (optional). **Button:** „Rezervați ora de 10:30”. |

```
DESKTOP
+------------------------------------------------------------------------------------------+
| [mark] DENTAL ARENA          Cristești 0265 326 316   Luduș 0365 430 125      Închideți  |
|                                                                                          |
|   (filled)  Motivul și clinica  | Pasul 2 din 4                    |  Programarea        |
|   (outline) Ziua și ora      <  | Când vă convine?       Forum 36  |  Consultație sau    |
|   (empty)   Cum vă simțiți      | Medic: [Oricare][Mașca][Marcoci] |  control            |
|   (empty)   Datele dvs.         | [lun 6][mar 7][mie 8][joi 9] >   |  Cristești,         |
|      (apex)                     | Dimineața                        |  str. Principală    |
|   the thread rail, 160px tall   | [09:00] [09:30] [10:30]          |  536J/1             |
|   + <ol> of step names          | După-amiaza                      |  (rows flash        |
|                                 | [14:00] [15:30] [16:00]          |   menta-pal 600ms   |
|                                 | Nu găsesc o oră potrivită.       |   on change)        |
|                                 | Prefer să mă sunați.             |  Preferați la       |
|                                 | Înapoi              [Continuați] |  telefon?           |
|   cols 1-3                      | cols 4-9                         |  cols 10-12, sticky |
+------------------------------------------------------------------------------------------+

MOBILE
+------------------------------+
| Închideți            Sunați  |
| [28px thread] Pasul 2 din 4  |
| Când vă convine?             |  Forum 28
| [Consultație, Cristești  v]  |  collapsed summary
| [lun 6][mar 7][mie 8] >      |  scroll-snap
| Dimineața                    |
| [09:00] [09:30] [10:30]      |  slot buttons 56px
+------------------------------+
| Înapoi     [  Continuați  ]  |  sticky
+------------------------------+

CONFIRMATION (centred on the axis)
|              the crown outline draws onto the filled screw: the full mark                |
|                    Ora de 10:30 este rezervată.                  Forum 48                |
|      Marți, 7 octombrie, Dental Arena Cristești, str. Principală 536J/1                  |
|      Vă sunăm de la 0265 326 316 ca să confirmăm.                                         |
|      (if Mi-e frică:) Am notat că vă e teamă. Medicul va ști înainte să intrați.         |
|      [ Adăugați în calendar ]   [ Deschideți harta ]   Ce să aveți la dumneavoastră       |
```

**Behaviour:**
- Completed step names in the rail are links back to that step.
- Going back keeps all data.
- If the visitor arrives with values already set, the wizard skips to the first unanswered step. Because steps 1 and 2 come first, the thread always fills in order.

**Errors** say what to do:
- „Introduceți un număr de telefon, de exemplu 0745 123 456.”
- „Ora de 10:30 tocmai a fost ocupată. Alegeți altă oră; celelalte date au rămas completate.”

**Empty state:** „Nu mai sunt ore libere săptămâna aceasta la Luduș. Vedeți săptămâna următoare sau sunați la 0365 430 125.”

**CAPTCHA.** No cognitive puzzles (WCAG 3.3.8). Use a honeypot plus rate limiting.

### 6.8 CRM ("Cabinet")

The CRM shell is light by default (theme toggle in Setări). Sidebar:
- 240px wide, on `fundal`, collapsing to a 64px rail that shows only the mark.
- The active item has a `menta-pal` fill, a 3px `actiune` left bar and Red Hat 600 text.
- The work area is `suprafata`.

```
CRM SHELL + CALENDAR, DAY VIEW (1440)
+----------------+------------------------------------------------------------------------------+
| [mark] Cabinet | [Cristești|Luduș|Ambele]  [ Căutați pacient: nume, telefon  (/) ] [Programare nouă] |
|                +------------------------------------------------------------------------------+
| Azi            | Marți, 6 octombrie       Forum 28    < Azi >   [Zi|Săptămână]  Medici v  Cabinete |
| Calendar     < | +-----+-----------------+-----------------+-----------------+-----------------+ |
| Cereri online 3| |     | Dr. Marcoci     | Dr. Mașca       | Dr. Bologa      | Dr. Fertea      | |
| Pacienți       | |09:00|#Ion Pop    [v]  | :Ana Man    (c):|                 |#Vasile Boț [v]  | |
| Planuri        | |09:15|#Control         | :Consultație   :|                 |#Detartraj       | |
| De rechemat 12 | |09:30|[[Maria Suciu (o)]]|#Gh. Moldovan   |  ~~Dan Pop~~    |                 | |
| Încasări       | |09:45|[[Obturație 26  ]]|#Implant 36  [!]|  anulat         |                 | |
| Prețuri        | |10:00|[[Sosit, 12 min ]]|#                |                 |%Elena Rus      | |
| Echipă         | |10:15|                 |                 |                 |%Neprezentat    | |
| Mesaje         | |10:50|====================== now line, actiune, 2px, label 10:50 ==============| |
| Rapoarte       | |11:00|                 |#Ioana, 8 ani (o)|                 |                 | |
| Setări         | +-----+-----------------+-----------------+-----------------+-----------------+ |
| ---            |                                                                              |
| Ana, Recepție  |   drawer (right, 400px, shadow-float): patient, status actions, flags        |
+----------------+------------------------------------------------------------------------------+
 Legend (ASCII stand-ins):
   :..: dashed edge = Programat (c = online source)    # bar on menta-pal = Confirmat
   [[ ]] solid menta fill = Sosit                      ~~ ~~ struck, dashed = Anulat
   % carmin bar on carmin-pal = Neprezentat            (o) mustard comfort dot + tag in the drawer
   [!] medical alert icon                              [v] check icon (status icon)
```
**Calendar:**
- 15-minute rows at 24px. Columns are the doctors at the selected clinic; there is a switch to show cabinets (rooms) instead. Week view is per doctor.
- Drag moves or resizes an appointment. The drag shows a 60%-opacity ghost that snaps to the grid. After a move, a toast reads „Programare mutată la 11:30” with „Anulați” (undo) for 6 seconds.
- Clicking an empty slot opens a quick-create popover with:
  - patient search
  - motiv, with the duration preset from the price list
  - an inhalosedare toggle, which also books the single inhalosedare unit so it can't be double-booked
- **Drawer actions follow the status order:** Confirmați programarea, then A sosit, then Finalizați. Mutați and Anulați are always available. After the visit time: Neprezentat.

```
AZI (dashboard)
+----------------+------------------------------------------------------------------------------+
| sidebar        | Marți, 6 octombrie                                              Forum 28     |
|                | Cristești: 14 programări, 3 cereri online de confirmat, 2 pacienți de rechemat.|
|                | Încasat azi: 4.350 lei.                     (one sentence, no KPI tiles)     |
|                | +- Programările de azi (cols 1-8) ----------+ +- De făcut (cols 9-12) -------+ |
|                | | 09:00 Ion Pop       Dr. Marcoci Control [v] | | Cereri online (3)            | |
|                | |       [Confirmați] [A sosit] [Sunați]       | |  Ana Man, consultație,       | |
|                | | 09:30 Maria Suciu (o) Mi-e frică  Dr. Mașca | |  mar. 7 oct. 10:30, Mi-e frică| |
|                | |       Obturație 26  Confirmat               | |  [Confirmați] [Sunați]       | |
|                | | ...                                         | |  [Propuneți altă oră]        | |
|                | +---------------------------------------------+ | De rechemat (12): control la | |
|                |                                                 | 6 luni după profilaxie       | |
|                |                                                 | Solduri restante             | |
|                |                                                 +------------------------------+ |
+----------------+------------------------------------------------------------------------------+

FIȘA PACIENTULUI
+----------------+------------------------------------------------------------------------------+
| sidebar        | Pacienți / Maria Suciu                                                       |
|                | Maria Suciu            Forum 28     58 de ani, Cristești, medic curant Dr. Mașca |
|                | 0744 123 456   [Sunați] [Programați] [Trimiteți SMS] [Încasați]   Sold 450 lei  |
|                | [! Alergie: penicilină]  [(o) Mi-e frică]  [Preferă inhalosedare]             |
|                | +- mustar-pal note -----------------------------------------------------------+ |
|                | | La programare a scris: „Am avut o extracție grea acum mulți ani.”            | |
|                | +----------------------------------------------------------------------------+ |
|                | Prezentare | Odontogramă | Plan de tratament | Programări | Încasări |          |
|                | Anamneză | Documente | Consimțăminte | Confort                                 |
|                | 18 17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28     tooth glyphs in the     |
|                | 48 47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38     mark's stroke style     |
|                | Legend: C carie  O obturație  E endodonție  Cr coroană  X extras  I implant    |
|                | Plan: implant 36   [thread: 2 of 5 bands]   Vindecare până la 12.01.2027      |
|                | Implant Neodent ............ 2.200 lei   Efectuat 14.10.2026                  |
|                | Total 3.750 lei, achitat 3.300 lei                                            |
+----------------+------------------------------------------------------------------------------+
```
**Odontogram:**
- FDI numbering: 11–48 for adults, 51–85 for children.
- Each finding is coded by colour, pattern **and** letter. An implant is drawn as the mini thread glyph (§7).
- Clicking a tooth adds a finding or a treatment line, priced from Prețuri.

**CRM modules:**
1. Azi.
2. Calendar.
3. Cereri online.
4. Pacienți (list and patient file).
5. Planuri de tratament (phases, accepted plan exported as a signed PDF deviz).
6. De rechemat (recalls with call outcomes).
7. Încasări (payments, partial payments, receipts; invoicing integration still to be decided).
8. Prețuri și servicii (the single source for the website price lists, booking reasons and durations).
9. Echipă și program (feeds online availability and the team pages).
10. Mesaje (SMS and e-mail reminders 24h ahead, formal templates).
11. Rapoarte (plain tables plus one line chart: visits per week per clinic).
12. Setări și GDPR:
    - roles: Administrator, Medic, Asistentă, Recepție
    - audit log
    - CNP masked by default
    - consent records, export and erasure requests
    - theme and density settings

**Keyboard shortcuts:**
- `N`: new appointment
- `/` or `Ctrl+K`: search
- Arrow keys: move through the calendar
- `Enter`: open an item
- `Esc`: close

---

## 7. Signature element: *Filetul* (the thread)

**What it is.** A progress glyph built from the logo's implant screw. It fills band by band as the patient moves through a real sequence. When the booking completes, the crown outline is drawn on top and the full Dental Arena mark appears. This follows real clinical order: the implant goes in first, and the crown is fitted last. The bands narrow towards the tip, so the shape itself says "nearly done".

**Construction:**
- Trace the logo once into SVG, or better, get the original vector from whoever made the clinic's sign.
- Keep the crown stroke, the tapered crescent bands and the apex as separate paths.
- A glyph has N bands taken from the top of the traced root (4 for booking, 5 for an implant plan), plus the apex. The bands are never redrawn by hand.

**States:**

| State | Light | Dark |
|---|---|---|
| Done | filled `menta` | filled `menta` |
| Current | 1.5px `cerneala` outline | 1.5px `cerneala` outline |
| Future | 1.25px `linie-control` outline | 1.25px `linie-control` outline |

**Sizes:** 160px tall in the desktop rail, 28px inline on mobile, 14px in the odontogram.

**Accessibility:** the glyph is `aria-hidden`. Next to it there is always an `<ol>` of step names with `aria-current="step"`, plus the visible text „Pasul 2 din 4”.

**Where it appears** (these places only):
1. The booking progress rail, and the confirmation (where the crown is drawn).
2. „Cum decurge” on Implantologie, Ortodonție and Inhalosedare. In the CRM: implant treatment-plan progress (radiografii, implant, vindecare 3–6 luni, bont, coroană).
3. The implant symbol in the CRM odontogram. The brand mark becomes the clinical notation.

**Never:** a decoration, a section divider, a bullet, a loading spinner on unrelated screens, or a realistic screw illustration.

The comfort question (§6.4) is **not** a second motif. It uses standard choice buttons and adds only the mustard meaning. The system's single bold device stays the thread.

---

## 8. Motion

**The one orchestrated moment** is triggered by the user. When „Rezervați ora de 10:30” succeeds:
1. The crown outline draws onto the filled screw: `stroke-dashoffset`, 700ms, `ease-filet`.
2. 120ms later, the confirmation text fades in over 160ms.

Nothing else in the product is choreographed.

**Motion in response to an action:**

| Trigger | Motion |
|---|---|
| „Continuați” in booking | The current band fills with Mentă (220ms). The step content crossfades over 160ms with a 12px shift in the direction of travel; „Înapoi” mirrors it. |
| A value lands in the booking summary | That row flashes `menta-pal` and fades out over 600ms. |
| Choosing a slot or a choice button | Fill and check mark (120ms). |
| Choosing a comfort answer | The chip fills (150ms). The reply panel opens with height and opacity (220ms); its text arrives 60ms later. Changing the answer crossfades the text in place. |
| Sunați menu, mobile sheet | 200ms rise. |
| Accordion | 200ms. |
| CRM drawer, popover | 150–180ms. All CRM durations are capped at 180ms. |
| Calendar drag | A 60%-opacity ghost that snaps to the 15-minute grid. Toast with undo for 6s. |
| Slow availability (>600ms) | The thread bands fill in sequence as the only loading indicator. Below that threshold, show static grey outlines. |

**What never moves:**
- Nothing animates on page load or on scroll: no fade-and-slide sections, no parallax, no counters.
- Hover changes colour and underline only: no lift, no scale, no shadow change.
- Buttons get a 1px `translateY` while pressed.

**`prefers-reduced-motion`:** every duration drops to 0. The crown appears complete, fills are instant and panels open instantly.

---

## 9. Imagery

### 9.1 Where each research file goes

| File (`research/media/`) | What it shows | Use |
|---|---|---|
| `Picture1.jpg` (1430×953) | The receptionist in mint scrubs hands papers to a patient; daylight. | **Home hero**: a 4:5 crop on the hand-over (gives a 762×953 source, enough at about 410px wide on desktop). Mobile: 4:3. Also the Despre noi lead image. |
| `438712305_…_n.jpg` (1536×2048) | The waiting room: yellow sofa, mandala chairs, painting. | **Home comfort section** (3:4). This is the photographic source of the mustard. |
| `Picture2-1.jpg` (1430×953) | A gerbera and a framed print in front of the yellow sofa. | Despre noi. Small use on the Inhalosedare page. |
| `438716692_…_n.jpg` (1536×2048) | The treatment chair with the beach mural. | **Home „Copiii”** and the Pedodonție and Inhalosedare pages. Caption: „Cabinetul cu marea pe perete”. `b62b3b23…jpg` and `WhatsApp…09.13.08-2.jpeg` are duplicates. |
| `Picture3-1.jpg` (1430×953) | The waiting room wide, with the colourful painting and reception desk. | /clinici page of the clinic it belongs to (confirm which), and Contact. |
| `WhatsApp-Image-2024-04-12-at-09.13.07.jpeg` (1536×2048) | A living moss wall with the white logo mark. | Despre noi and the 404 page. `c67ef737…jpg` is a duplicate. |
| `407869274_…_n.jpg` (1440×1800) | The house front at dusk, lit path, sign. | /clinici page of the clinic it belongs to, presumed **Cristești** (to confirm). Replaces the small `Untitled-design-2024-05-27T102007.291.png` (600×557, same scene). |
| `WhatsApp-Image-2024-04-12-at-09.13.08.jpeg` (1536×2048) | The same house by day, gate and garden. | The same clinic page, as the directions photo („Cum ne găsiți”). |
| `DSC1557-Copy.jpg` (2500×1668) | An aluminium shopfront with the sign „DENTAL ARENA / CLINICA STOMATOLOGICA”. | /clinici page, presumed **Luduș** (to confirm). Home clinics section. |
| `1-1.jpg` (938×656) | A doctor explaining an X-ray on a tablet to a patient in the chair. | Despre noi, next to „Precizie: radiografii înainte și după fiecare intervenție”. Displayed at 480px or less (low resolution). |
| `312167804_…_n.jpg` (1440×1440) | Dr. Andrei Marcoci, slate wall, mustard chair. | Team, 4:5 crop. |
| `Untitled-design-2024-05-27T102139.723.png` (600×557) | Dr. Mihail Dan Mașca, slate wall, ochre chair. | Team, 4:5 crop (445×557 source; team row only). Ask the clinic for the original. |
| `328740551_…_n.jpg` (1440×1800) | Dr. Paul Bologa, cream wall, brown chair (a different shoot). | Team, 4:5. Neutralise the white balance toward the others. |
| `431150871_…_n.jpg` (1289×844) | Dr. Ana-Maria Fertea, slate wall, mustard chair. Landscape. | Team, a 4:5 crop from the centre (675×844). |
| `Untitled-design-2024-05-27T094429.697.png` | The logo reversed on black. | Reference for the reversed lockup only. Never published as is. |
| `164964094_…-e1716794678679.jpg` | The master logo (JPG). | Source for tracing the SVG. Never placed as a JPG with its white box. |
| `anpc-1-300x76-1.jpg`, `anpc-2-300x76-1-1.jpg` | ANPC SAL and SOL pictograms. | Footer. Legally required, linked to anpc.ro and the EU ODR page. |

**Retire:**
- `15-Ani-zambete-stralucite-cu-Dental-Arena.png`: the red gift box, off-brand, and the promotion has expired.
- All stock „Untitled-design-2024-05-29T*.png” service images: blue gloves, generic mouths, a logo stamped in the corner.
- `…05-27T130820.634.png`, `…05-13T112021.742.png` and the mint banner strips `…05-27T131528.593.png` and `…05-28T114720.636.png`.
- `…05-29T130321.118.png`: the stock implant model, wrongly used as Dr. Podar's portrait.
- `cropped-…512px` favicon: replaced by the SVG mark.

### 9.2 Treatment rules

- Only real photos of Dental Arena. No stock faces, no illustrations, no icon trios, no 3D teeth, no cartoon teeth.
- Grade neutral to slightly cool, and keep the clinic's real colours (the mustard stays mustard). No duotones, overlays, gradients or blur.
- Photos use `radius-foto` (2px). Captions in `text-mic` `discret` say what and where. Alt text is in Romanian.
- No surgical close-ups and no instruments in the first screen of any page.
- Use `next/image` with explicit `sizes`. Hero `priority`; everything else lazy.

### 9.3 Portraits

- All portraits are 4:5. Eye-lines sit on a shared line about 32% from the top, on a `fundal` field.
- **Dr. Podar Victoria-Ana:** until a real portrait exists, she gets a `menta-pal` plate with „VP” in Forum 48 (`cerneala`), plus her name and specialty. Never a stock face.
- **Recommended half-day shoot in both clinics:**
  - Dr. Podar and Dr. Bologa against the slate wall with the ochre chair, matching the other three
  - Dr. Mașca at full resolution
  - doctors at work (hands, mirror, tray)
  - the inhalosedare nasal mask on a calm adult, because how small it is reassures people
  - a parent and child in the beach-mural room (with written consent)
  - each treatment room
  - both façades in daylight
  - the receptionist

### 9.4 Logo assets (redraw as SVG; keep the geometry and colours)

| Variant | Use | Minimum size |
|---|---|---|
| Full lockup (mark, wordmark, hairline, „CLINICA STOMATOLOGICA”) | Footer, Despre noi, documents (deviz, receipts) | 220px wide (below that the subline renders under about 7px) |
| Compact lockup (mark plus wordmark, no subline) | Site header, booking header | 140px wide |
| Mark only | Favicon (simplified to 3 bands below 32px), collapsed CRM sidebar, app icon, mobile booking header | 16px |
| Reversed (white wordmark, Mentă mark) | Footer on `subsol`, dark mode | as above |
| Single colour `cerneala` | Print and fax forms | as above |

- Clear space around the logo equals the cap height of the „D”.
- Never recolour the mark mustard. Never stretch it, and never place it on a photo without a solid ground.
- The physical sign (black letters, vivid green mark) is a fabrication of the same logo. The screen colours stay mint and slate.

### 9.5 Icons

Use one outline set with a 1.5px stroke and round caps (for example Lucide), and **only where an icon speeds recognition**: phone, map pin, calendar, clock, check, close, alert, door-enter, user-x, circle-slash, search. There are also custom glyphs for inhalosedare and copil in the CRM. Never put icons on service lists or feature lists.

---

## 10. Component inventory

Components are shared unless marked as site-only or CRM-only. They read role tokens only, and shrink under `data-density="compact"`.

| Component | Variants and states | Notes |
|---|---|---|
| `Logo` | full, compact, mark, reversed, mono | SVG only. |
| `Button` | primary (`actiune`), secondary (1.5px `cerneala` outline), text (link style); M 48 / L 56 on the site, S 32 / M 40 in the CRM; disabled; loading (label stays, plus a spinner) | The label names the result. No arrows. |
| `Link` | inline (always underlined), standalone, nav (current = `link` colour plus underline) | |
| `PhoneLink` | with clinic label, compact | No-break grouping, `tel:` link. |
| `CallMenu` / `CallSheet` (site) | desktop menu, mobile bottom sheet | Two rows, one per clinic. |
| `StickyCallBar` (site) | | 56px; respects the safe area. |
| `SiteHeader`, `ServicesMenu`, `SiteFooter` (site) | | The footer includes the ANPC pictograms. |
| `AvailabilityPanel` (site) | two clinics (desktop), segmented (mobile), loading, empty or offline (shows phones) | Split on the axis. |
| `SlotButton` | default, hover, selected (`menta` fill, 2px `cerneala` border, check), disabled, taken | Shared with the CRM quick-create. |
| `ChoiceButton` | neutral, comfort (mustard when chosen), with description line | 56px on the site. |
| `ChoicePanel` | clinic panel, with the next free slot | radius 12. |
| `ComfortQuestion` (site) | idle, answered with reply, without JS | Writes to `sessionStorage`. |
| `ComfortNote` | `mustar-pal` panel | Site: „Vă e teamă?”. CRM: the patient's own words. |
| `ServiceIndex` (site) | | Text rows with a representative price. |
| `PriceTable` | grouped, with dotted leaders, searchable (on `/preturi`) | Data from the CRM. Right-aligned tabular figures. |
| `ThreadSteps` | booking rail, inline 28px, „Cum decurge” list, treatment-plan progress, odontogram mini | See §7. |
| `DoctorFigure` | row item, profile header, monogram plate | Not a card. |
| `ClinicSplit` (site) | | Map behind consent. |
| `MapConsent` (site) | static image, then the embed after a click | |
| `Breadcrumbs` (site) | | |
| `Accordion` („Întrebări”) | | Clinic-approved answers only. |
| `BookingShell` (site) | rail, step, summary (sticky on desktop, collapsed on mobile), sticky actions | |
| `WeekStrip` | 14 days, with disabled days | |
| `TextField`, `PhoneField`, `TextArea`, `Select`, `Checkbox`, `RadioGroup`, `ConsentCheckbox` | default, focus, error (with `carmin` message linked via `aria-describedby`), disabled | Labels are always visible, never placeholder-only. |
| `ErrorSummary` | | `carmin-pal`, focused on submit. |
| `EmptyState` | | One sentence of direction plus one action. |
| `Toast` | success, with undo, error | Polite live region. Stays 6s. |
| `Confirmation` (site) | | Crown draw; adds an `.ics` calendar file. |
| `CookieConsent` (site) | | Fully Romanian: „Acceptați toate”, „Refuzați”, „Setări”. |
| `AppShell` (CRM) | sidebar expanded or rail, top bar | |
| `ClinicSwitch` (CRM) | Cristești, Luduș, Ambele | Segmented control. |
| `GlobalSearch` / `CommandPalette` (CRM) | | `/` and Ctrl+K. Searches by name or phone. |
| `CalendarDay`, `CalendarWeek` (CRM) | by doctor, by cabinet | Time gutter, now-line. |
| `AppointmentBlock` (CRM) | 6 statuses; comfort, alert, child and online overlays; 15 / 30 / 60+ min layouts | See §3.3. |
| `QuickCreatePopover`, `AppointmentDrawer` (CRM) | | |
| `StatusChip`, `FlagTag`, `CountBadge` (CRM) | | Pill radius. Never colour alone. |
| `WorkQueue` (CRM) | cereri online, de rechemat, solduri | |
| `DataTable` (CRM) | sortable, selectable, 36 / 44px rows, tabular figures | |
| `PatientHeader`, `Tabs` (CRM) | | |
| `Odontogram` (CRM) | adult or child, findings legend | |
| `TreatmentPlan` (CRM) | phases, lines, totals, acceptance PDF | |
| `PaymentForm`, `ReceiptList`, `PriceEditor`, `ScheduleEditor`, `MessageTemplateEditor`, `AuditLog`, `ReportTable`, `LineChart` (CRM) | | The chart follows the dataviz rules, using brand mint and slate. |

---

## 11. Accessibility floor (WCAG 2.2 AA)

### 11.1 Contrast, computed with the WCAG 2.x relative-luminance formula

**Light**

| Pair | Foreground | Background | Ratio | Need |
|---|---|---|---|---|
| Body text on page | `cerneala` #252E2C | `fundal` #F4F7F5 | **12.93** | 4.5 |
| Body text on panels and inputs | #252E2C | `suprafata` #FFFFFF | **13.95** | 4.5 |
| Text on recessed surfaces and Finalizat | #252E2C | `adancit` #EEF2F0 | **12.35** | 4.5 |
| Secondary text on page | `discret` #5C6765 | #F4F7F5 | **5.43** | 4.5 |
| Secondary text on panels | #5C6765 | #FFFFFF | **5.86** | 4.5 |
| Finalizat label | #5C6765 | #EEF2F0 | **5.19** | 4.5 |
| Captions on Mentă pal | #5C6765 | `menta-pal` #E4F3EA | **5.11** | 4.5 |
| Links on page | `link` #1F6B4C | #F4F7F5 | **5.96** | 4.5 |
| Links on panels | #1F6B4C | #FFFFFF | **6.43** | 4.5 |
| Links on Mentă pal | #1F6B4C | #E4F3EA | **5.61** | 4.5 |
| Link inside the comfort reply | #1F6B4C | `mustar-pal` #FBEFC9 | **5.60** | 4.5 |
| Primary button label | #FFFFFF | `actiune` #1F6B4C | **6.43** | 4.5 |
| Primary button, hover or pressed | #FFFFFF | #185A3F | **8.16** | 4.5 |
| Text on Mentă fills (selected slot, Sosit) | `pe-menta` #252E2C | `menta` #7DC9A1 | **7.13** | 4.5 |
| Text on Mentă pal (Confirmat, selected panel) | #252E2C | #E4F3EA | **12.16** | 4.5 |
| Text on comfort panel | #252E2C | #FBEFC9 | **12.15** | 4.5 |
| Comfort tag label on pale fill | `mustar-text` #7A5600 | #FBEFC9 | **5.79** | 4.5 |
| Comfort tag label on panels | #7A5600 | #FFFFFF | **6.65** | 4.5 |
| Text on a chosen comfort chip | #252E2C | `mustar` #E0AC2B | **6.71** | 4.5 |
| Error or alert text on panels | `carmin` #B42318 | #FFFFFF | **6.57** | 4.5 |
| Error text on page | #B42318 | #F4F7F5 | **6.10** | 4.5 |
| Neprezentat label | #B42318 | `carmin-pal` #FBE9E7 | **5.61** | 4.5 |
| Text on a Neprezentat block | #252E2C | #FBE9E7 | **11.89** | 4.5 |
| Footer text and footer focus ring | #FFFFFF | `subsol` #5C6765 | **5.86** | 4.5 |
| *Non-text:* control borders on panels | `linie-control` #7E8C88 | #FFFFFF | **3.50** | 3.0 |
| *Non-text:* control borders on page | #7E8C88 | #F4F7F5 | **3.25** | 3.0 |
| *Non-text:* control borders on recessed surfaces | #7E8C88 | #EEF2F0 | **3.10** | 3.0 |
| *Non-text:* focus ring on page | `focus` #1F6B4C | #F4F7F5 | **5.96** | 3.0 |
| *Non-text:* focus ring on panels | #1F6B4C | #FFFFFF | **6.43** | 3.0 |
| *Non-text:* focus ring on Mentă pal | #1F6B4C | #E4F3EA | **5.61** | 3.0 |
| *Non-text:* Confirmat bar | #1F6B4C | #E4F3EA | **5.61** | 3.0 |
| *Non-text:* Neprezentat bar | #B42318 | #FBE9E7 | **5.61** | 3.0 |
| *Non-text:* Programat dashed edge | #5C6765 | #FFFFFF | **5.86** | 3.0 |
| *Non-text:* selected-control 2px border | #252E2C | #FFFFFF | **13.95** | 3.0 |
| *Decorative:* Mentă mark and thread bands | #7DC9A1 | #FFFFFF | 1.96 | exempt: logo, or always paired with text and a border |
| *Decorative:* comfort dot | #E0AC2B | #FFFFFF | 2.08 | always has a 1px #7A5600 ring (6.65) and a text tag |
| *Logo:* reversed mark on footer | #7DC9A1 | #5C6765 | 3.00 | logos are exempt; still meets 3:1 |

**Dark**

| Pair | Foreground | Background | Ratio | Need |
|---|---|---|---|---|
| Body text on page | #E6EDEA | #1B2422 | **13.36** | 4.5 |
| Body text on panels | #E6EDEA | #232D2B | **11.92** | 4.5 |
| Text on recessed surfaces and Finalizat | #E6EDEA | #2C3734 | **10.37** | 4.5 |
| Secondary text on page | #A6B3AF | #1B2422 | **7.33** | 4.5 |
| Secondary text on panels | #A6B3AF | #232D2B | **6.54** | 4.5 |
| Finalizat label | #A6B3AF | #2C3734 | **5.69** | 4.5 |
| Captions on Mentă pal | #A6B3AF | #1F3B2F | **5.62** | 4.5 |
| Links on page | #8FD6B1 | #1B2422 | **9.40** | 4.5 |
| Links on panels | #8FD6B1 | #232D2B | **8.38** | 4.5 |
| Links on Mentă pal | #8FD6B1 | #1F3B2F | **7.20** | 4.5 |
| Link inside the comfort reply | #8FD6B1 | #3B321A | **7.50** | 4.5 |
| Primary button label | #13241D | #7DC9A1 | **8.28** | 4.5 |
| Primary button, hover or pressed | #13241D | #96D6B4 | **9.69** | 4.5 |
| Text on Mentă fills (selected slot, Sosit) | #13241D | #7DC9A1 | **8.28** | 4.5 |
| Text on Mentă pal (Confirmat) | #E6EDEA | #1F3B2F | **10.24** | 4.5 |
| Text on comfort panel | #E6EDEA | #3B321A | **10.66** | 4.5 |
| Comfort tag label on pale fill | #F2C862 | #3B321A | **7.97** | 4.5 |
| Comfort tag label on panels | #F2C862 | #232D2B | **8.92** | 4.5 |
| Text on a chosen comfort chip | #13241D | #E0AC2B | **7.79** | 4.5 |
| Error or alert text on panels | #F0877D | #232D2B | **5.71** | 4.5 |
| Error text on page | #F0877D | #1B2422 | **6.40** | 4.5 |
| Neprezentat label | #F0877D | #3F2522 | **5.65** | 4.5 |
| Text on a Neprezentat block | #E6EDEA | #3F2522 | **11.78** | 4.5 |
| Footer text | #E6EDEA | #232D2B | **11.92** | 4.5 |
| *Non-text:* control borders on panels | #7C8C87 | #232D2B | **4.02** | 3.0 |
| *Non-text:* control borders on page | #7C8C87 | #1B2422 | **4.51** | 3.0 |
| *Non-text:* control borders on recessed surfaces | #7C8C87 | #2C3734 | **3.50** | 3.0 |
| *Non-text:* focus ring on page | #8FD6B1 | #1B2422 | **9.40** | 3.0 |
| *Non-text:* focus ring on panels | #8FD6B1 | #232D2B | **8.38** | 3.0 |
| *Non-text:* focus ring on Mentă pal | #8FD6B1 | #1F3B2F | **7.20** | 3.0 |
| *Non-text:* Confirmat bar | #7DC9A1 | #1F3B2F | **6.23** | 3.0 |
| *Non-text:* Neprezentat bar | #F0877D | #3F2522 | **5.65** | 3.0 |
| *Non-text:* Programat dashed edge | #A6B3AF | #232D2B | **6.54** | 3.0 |
| *Non-text:* selected-control border | #E6EDEA | #232D2B | **11.92** | 3.0 |
| Mentă mark on panels | #7DC9A1 | #232D2B | 7.25 | n/a |
| Comfort dot | #E0AC2B | #232D2B | 6.82 | n/a |

**Forbidden pairs:**
- Mentă as text on light grounds (1.81–1.96).
- Light text on Mentă (1.64 in dark mode). Text on Mentă is always `pe-menta`.
- Muștar as text on white (2.08).
- `linie` #D3DDD9 as the only boundary of a control (1.3).

### 11.2 Other requirements

- **Not colour alone.** Every status, comfort answer, finding and thread state has a word, an icon or a pattern as well.
- **Focus.** Always visible: a 2px `focus` outline with a 2px offset. On the footer, the ring is `pe-subsol`. Focus is never hidden under the sticky header or bar; use `scroll-padding`.
- **Target sizes.** At least 48×48px on the public site (56px for slots, choices and the sticky bar). At least 32px in the CRM; nothing below the 24px minimum of WCAG 2.5.8.
- **Text.** Public text is never below 16px, except the 14px legal line. CRM minimum is 12px. Layouts must survive 200% zoom and 320px width without horizontal scroll.
- **Forms.**
  - Visible labels.
  - `autocomplete` (name, tel, email).
  - Errors as text next to the field and in an `ErrorSummary` that receives focus.
  - Nothing is lost when going back.
  - If slots are held, warn before any hold expires.
- **Motion.** `prefers-reduced-motion` is honoured everywhere (§8). Nothing autoplays.
- **Language.**
  - `lang="ro"` on every page.
  - Comma-below ș ț.
  - The screen-reader text for a phone number gives the clinic name first: „Sunați la Cristești, 0265 326 316”.
- **Keyboard.** The whole booking flow and the whole CRM calendar work from the keyboard, including drag alternatives (a „Mutați” dialog).
- **Privacy as accessibility.** Maps and third-party embeds load only after consent. CNPs are masked by default in the CRM.

---

## 12. Copy and tone (reguli de scriere, în română)

### 12.1 Registrul

- **Ne adresăm cu „dumneavoastră”**, peste tot pe site, în SMS-uri și în e-mailuri. Publicul este format din adulți și familii din orașe mici, mulți peste 50 de ani. Site-ul actual amestecă „tu” cu „vă”; de acum folosim doar forma de politețe.
  - Exemple: „Programați-vă”, „Sunați-ne”, „Vă e teamă?”.
  - Sloganurile cu „tu” se rescriu. „Calea ta către un zâmbet perfect” devine, de exemplu, „Zâmbete sănătoase pentru o viață fericită.” (sloganul existent, păstrat neschimbat).
- **Pacientul vorbește la persoana I** în variantele de răspuns: „N-am emoții”, „Am puține emoții”, „Mi-e frică”, „Am o durere acum”, „Prefer să mă sunați”.
- **În CRM** tonul rămâne simplu și politicos. Mesajele către personal sunt la imperativ de politețe: „Confirmați programarea”, „Sunați pacientul”.

### 12.2 Vocea

- **Simplu, calm, concret.** Spunem ce se întâmplă, cât durează și cât costă. Nu vindem.
- **Folosim cuvintele clinicii**: „mână ușoară”, „fără durere, fără frică”, „se respectă programările”, „copiii se întorc cu plăcere”.
- **Fără semne de exclamare.** Fără „!” după „Sună acum”, fără superlative goale („cele mai moderne”, „de excelență”) și fără promisiuni absolute („100% sigură”, „garantat”).
- **Fără termeni medicali neexplicați** pe site. Prima dată când apare un termen, îl explicăm într-o frază: „inhalosedare: respirați un amestec care vă relaxează; rămâneți conștient”.
- **Sentence case**, adică doar prima literă mare. Fără titluri scrise numai cu majuscule.

### 12.3 Acțiunea își păstrează numele pe tot parcursul

| Unde | Text |
|---|---|
| Header, CTA | „Programați-vă” |
| Pagini de serviciu | „Programați o consultație” |
| Panoul din hero | ora aleasă, apoi „Toate orele din Cristești” |
| Ultimul pas | „Rezervați ora de 10:30” |
| Confirmare | „Ora de 10:30 este rezervată.” și „Vă sunăm de la 0265 326 316 ca să confirmăm.” |
| CRM, programare nouă de pe site | statusul **Programat**, cu eticheta „Online” |
| CRM, acțiune | „Confirmați programarea”, cu toast-ul „Programare confirmată” |
| SMS către pacient | „Programarea de marți, 7 octombrie, ora 10:30, la Dental Arena Cristești este confirmată. Dacă nu mai puteți veni, sunați la 0265 326 316.” |
| CRM, alte acțiuni | „A sosit” (statusul Sosit), „Finalizați” (Finalizat), „Anulați programarea” (Anulat, toast „Programare anulată”), „Marcați ca neprezentat” (Neprezentat) |

Etichetele de stare din CRM sunt exact: **Programat, Confirmat, Sosit, Finalizat, Anulat, Neprezentat**.

### 12.4 Erori și stări goale

Erorile spun ce s-a întâmplat și ce aveți de făcut. Nu își cer scuze și nu sunt vagi.
- „Introduceți un număr de telefon, de exemplu 0745 123 456.”
- „Ora de 10:30 tocmai a fost ocupată. Alegeți altă oră; celelalte date au rămas completate.”
- În CRM: „Dr. Mașca are deja o programare la 10:30. Alegeți altă oră sau alt medic.”

Starea goală este o invitație la acțiune.
- „Nu mai sunt ore libere săptămâna aceasta la Luduș. Vedeți săptămâna următoare sau sunați la 0365 430 125.”
- În CRM: „Nicio cerere nouă. Cererile din site apar aici imediat ce sunt trimise.”

### 12.5 Ortografie și formatare

- Folosiți **ș ț cu virgulă dedesubt**, niciodată ş ţ cu sedilă. Restaurați diacriticele lipsă:
  - „Extractie” → „Extracție”
  - „Aditie os” → „Adiție os”
  - „Indepartat coroana” → „Îndepărtare coroană”
  - „bracketi” → „brackeți”
  - „ortodontie si ortopedie dento-faciala” → „ortodonție și ortopedie dento-facială”
  - „Consultatie” → „Consultație”
- Ghilimele românești: „…”.
- Linie de pauză (en dash) pentru intervale: „3–6 luni”.
- Prețuri: „2.200 lei”, „de la 200 lei”, „200 / 350 lei”, „150 lei / oră”.
- Date: „marți, 7 octombrie”. Ore: „09:30”.
- Telefoane: „0265 326 316”, întotdeauna cu numele clinicii.
- Numele medicilor: „Dr. Andrei Marcoci” (prenume, apoi nume, ca pe site). Corectați „Dr Podar Victoria-Ana” → „Dr. Victoria-Ana Podar” și „Dr. Fertea Ana-Maria” → „Dr. Ana-Maria Fertea”.

### 12.6 Ce corectăm din textele actuale

- Pe pagina de acasă, textele de sub „Fără frică” și „Fără durere” sunt inversate. Pe Despre noi sunt corecte.
- Resturi în engleză: „Get in touch”, „Office Email Address”, „Ops! Something went wrong”. Tot bannerul de cookie-uri („Reject All”, „Accept All”, „Always Active”) se traduce.
- Meniul spune „Chirurgie orală și maxilo-facială”, dar serviciul este „Chirurgie dento-alveolară”. Folosim peste tot denumirea paginii.
- „Endodonție” și „Radiologie” apar pe pagina de acasă fără pagini proprii. Le includem în „Stomatologie generală” („Tratament de canal”) și în „Precizie” („radiografii înainte și după fiecare intervenție”).
- Titlul SEO al paginii „Consultație și profilaxie” este cel al Ortodonției. Îl corectăm.
- Eticheta „Dental Arena Clinic”, repetată deasupra fiecărui titlu, se elimină.
- „© 2025” devine anul generat automat.
- „la 1 km de Târgu Mureș” nu apare nicăieri; folosim „lângă Târgu Mureș”.

---

## 13. Data the design depends on (Prisma)

- **`Appointment`**:
  - `status`: PROGRAMAT | CONFIRMAT | SOSIT | FINALIZAT | ANULAT | NEPREZENTAT
  - `source`: ONLINE | TELEFON | RECEPTIE
  - `comfort`: FARA_EMOTII | EMOTII | FRICA | null
  - `wantsSedation`: boolean; it reserves the inhalosedare unit
  - `comfortNote`: text, the patient's own words
  - `forChild`, plus the child's first name and age
  - `clinicId`, `doctorId`, `cabinetId`, `start`, `end`, `reason`
- **`CallbackRequest`**: phone, clinic, reason, created, handledBy.
- **`Patient`**:
  - `guardianId`, for family booking
  - `comfortDefault`
  - alert flags derived from Anamneză
- **`PriceItem`**: `serviceSlug`, `group`, `name`, `priceMin`, `priceMax`, `unit`, `isRepresentative`, `durationMinutes`.
- **`Clinic`**: address, phone, opening hours, map coordinates. **`Doctor`**: slug, photo, specialties, schedule per clinic.

The website reads clinics, hours, doctors, prices and free slots from these models. It never holds its own copy.

---

## 14. Open items for the clinic

1. The opening hours of both clinics. They are not on the current site.
2. Which doctor works at which clinic, and on which days. Short bios.
3. Which exterior photos show which clinic. Presumed: the house with the lit path is Cristești, the shopfront is Luduș.
4. The real distance or wording for Cristești and Târgu Mureș (proposal: „lângă Târgu Mureș”).
5. A portrait of Dr. Podar. The original file of Dr. Mașca's portrait. Approval for the recommended photo shoot.
6. The price of a general consultation. Only the ortodonție consultation (150 lei) is listed.
7. Teeth whitening is 1.000 lei on Consultație și profilaxie and 800 lei (Opalescence Boost) on Estetică. Are these the same service?
8. Are online bookings held immediately (status Programat) and confirmed by phone, as this system assumes? Is SMS available?
9. The founding year (2009, inferred from the 2024 anniversary).
10. Approval of the new reassurance sentences, marked *(clinic to approve)* above, and of every „Întrebări” answer.
11. The texts for Termeni, Confidențialitate and Cookie-uri. These are required before the booking form goes live, because it collects health data.
12. The original vector logo, from whoever made the sign.
13. The invoicing integration (SmartBill or ANAF e-Factura).
