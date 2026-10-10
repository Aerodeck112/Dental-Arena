# Dental Arena, versiunea PHP (pentru cPanel fără Node.js)

The public site and the admin panel in plain PHP 8.1+ with MySQL, no framework and no Composer,
so it runs on any cPanel shared hosting. The markup, texts and design are the same as the
Next.js version in `src/`; the texts are exported from `src/content` at build time.

## Layout

```
php/
  public/              → public_html on the server (document root)
    index.php          front controller (finds ../dentalarena)
    .htaccess          rewrites to index.php, HTTPS, caching
    assets/site.js     the public site's JavaScript (vanilla, no build)
    assets/site.css    BUILT: Tailwind from src/app/globals.css + the PHP templates
    assets/fonts/      BUILT
    images/, brand/    BUILT: photos as WebP in several widths
    media/             photos uploaded from the panel (created at runtime)
  app/                 → dentalarena/ on the server, NEXT TO public_html (not web-accessible)
    bootstrap.php      loads config.php, src/*.php, templates/components.php
    config.php         written by the installer (/admin/instalare); never committed. Its `secret`
                       is also the CNP encryption key: losing it makes stored CNPs unreadable
    cron.php           CLI only (cPanel Cron Jobs, hourly): e-mail reminders + old-request purge
    data/*.json        BUILT: content.json (texts), seed.json, icons.json, art.json, images.json
    migrations/*.sql   applied in order by migrate()
    src/               helpers.php, db.php, content.php, images.php, seo.php, mail.php, auth.php,
                       repo.php, forms.php, routes.php, install.php, sitemap.php, admin/
    templates/
      layout.php       render_page($body, $meta, $jsonLd, $chrome = true), capture(fn)
      components/      ui.php, chrome.php, blocks.php, fields.php (shared; see below)
      pages/*.php      one file per public page; routes.php requires it
      admin/*.php      the panel's pages
```

## Build

- `npm run build:php` → data JSON, CSS, fonts, images.
- `node scripts/php/build.mjs --css` → only the stylesheet (run it after adding Tailwind classes).
- `npm run build:php:zip` → `deploy/dentalarena-php.zip` (public_html/ + dentalarena/).

Tailwind scans `php/app/templates`, `php/app/src` and `php/public/assets/*.js`. Write class names
literally (no string concatenation of partial class names), as in the Next.js components.

## Conventions

- `declare(strict_types=1);` in every file. PHP 8.1 compatible: no `readonly` classes, no DNF types.
- Escape every value with `e()`. Build class lists with `cn(...)`.
- A page template computes its data, captures its HTML with `capture(function () use (...) { ?> … <?php })`,
  then calls `render_page($body, page_meta([...]), json_ld(...))`.
- Same markup and classes as the matching Next.js component/page (reference HTML of the running
  Next site was saved per page); dynamic data comes from the helpers below.

### Helpers you can use

| Where | Function |
|---|---|
| helpers.php | `e`, `cn`, `site_url`, `absolute_url`, `asset`, `post`, `query`, `is_post`, `redirect`, `flash`, `take_flash`, `csrf_field`, `csrf_check`, `format_lei`, `format_phone`, `tel_href`, `format_date`, `format_datetime`, `slugify`, `parse_lei`, `lei_input`, `request_path`, `is_test_site` |
| db.php | `db()`, `db_all`, `db_one`, `db_value`, `db_run`, `db_insert`, `db_update`, `db_tx`, `now_sql`, `migrate` |
| content.php | `content('home.hero.lead')`, `service_content($slug)`, `service_slugs()`, `clinics()` (by slug: name, shortName, street, city, county, postalCode, phone, email, hoursText, area, mapsLink, mapsEmbed, photo, directionsPhoto?, id), `clinic_address`, `setting($k)`, `setting_save`, `legal_values()`, `fill_legal` |
| repo.php | `catalog()` (by slug: id, slug, name, summary, prices[], representative), `public_price`, `prices_by_code`, `public_doctors()`, `public_doctor_by_slug`, `doctors_for_category($slug)`, `site_image($slot)`, `doctor_photo($d)` |
| images.php | `photo($image, $sizes, $priority, $class, $position)` (fills a `relative` frame), `photo_static(...)`, `photo_sources`, `html_attrs`, `save_uploaded_photo($_FILES[x], $prefix)`, `delete_media` |
| seo.php | `page_meta([...title, description, path, image?, absoluteTitle?, noindex?])`, `json_ld(...$blocks)`, `breadcrumb_ld`, `dentist_ld`, `organization_ld`, `service_ld`, `faq_ld`, `physician_ld` |
| ui.php | `CONTAINER`, `icon($name, $size, $class, $label)`, `art($name, $class)`, `logo(...)`, `btn($variant, $size, $class)`, `phone_link($clinic, $class, $innerHtml)`, `booking_href([...])` |
| blocks.php | `service_hero([...])`, `booking_band(...)`, `service_grid(...)`, `clinic_cards(...)`, `price_table($prices, $label, $class)` (returns string), `doctor_portrait`, `doctor_figure` (return strings), `comfort_note()` (string), `phone_link_full(...)` |
| fields.php | `text_field`, `text_area`, `select_field`, `radio_group`, `checkbox_field`, `error_summary($errors)`, `success_panel`, `submit_button`, `input_classes` |
| forms.php | `bot_fields()`, `submit_lead('programare'|'contact')`, `TIME_WINDOWS`, `COMFORT_LABELS`, `LEAD_STATUS`, `purge_old_leads()` |
| admin/billing.php | `PAYMENT_METHODS`, `next_sequence` (gap-free numbers, inside `db_tx`), `line_totals`, `invoice_totals`, `line_problems`, `payment_state`, `open_amount`, `lei`, `amount_2d`, `patient_balance`, `invoice_candidates`, `create_invoice`, `insert_payment`, `cancel_invoice`, `cancel_payment`, `payments_table`, `invoices_table`, `lei_in_words` |
| admin/clinical.php | plans (`PLAN_STATUS`, `PLAN_TRANSITIONS`, `ITEM_TRANSITIONS`, `plan_totals`, `service_select`), odontogram (`TOOTH_KINDS`, `superseded_ids`, `odontogram_svg`), documents (`save_document`, `documents_dir`), consents (`CONSENT_TYPES`, `consent_text`), GDPR (`patient_export`, `anonymize_patient`), `patient_header` (the file's tabs), `print_page`, `seller_block`, `audit_label` |
| admin/lib.php | `csv_download`, `csv_lei`, `admin_period`, `admin_url`, `admin_section_open`, … |
| admin/crm.php | `APPT_STATUS`, `APPT_NEXT`, `RECALL_STATUS`, `HISTORY_FLAGS`, `can_see_clinical`, `cnp_valid`, `cnp_encrypt`/`cnp_decrypt`/`cnp_hash`/`cnp_masked`, `patient_name`, `patient_scope_sql`, `find_or_create_patient`, `medical_alerts`, `alert_chips`, `doctors_at`, `current_clinic_id`, `appointment_conflicts`, `can_see_appointment`, `set_appointment_status`, `send_due_reminders` |
| auth.php | `can($permission)` (`PERMISSIONS`: medical, plans.manage, billing, billing.cancel, documents.delete, reports.finance, gdpr, audit), `current_user`, `require_login($adminOnly)`, `is_admin`, `allowed_location_ids`, `attempt_login`, `logout`, `set_password`, `password_problem`, `audit`, `ROLES` |

## Local test environment

Apache + PHP 8.1 + MariaDB in Docker (what a typical cPanel runs):
the site at http://127.0.0.1:8081, panel at /admin (admin@dentalarena.ro / ParolaTest-2026),
installed in test mode (e-mails go to `php/app/storage/logs/app.log`).

## CRM (stage 2)

`migrations/002_crm.sql` adds `doctor_locations`, `patients`, `medical_histories`, `appointments`,
`patient_notes`, `recalls`, `users.doctor_id`, `leads.patient_id/appointment_id`. Access rules:

- every query on patients/appointments goes through `patient_scope_sql()` / `can_see_appointment()`
  (the user's clinics from `allowed_location_ids()`); another clinic's record is a 404;
- the full anamnesis and clinical notes only for `can_see_clinical()` (admin, medic); reception
  sees `medical_alerts()` only;
- the CNP is stored AES-256-GCM encrypted (`cnp_enc`) with an HMAC (`cnp_hash`) for duplicates.

Reminders: `send_due_reminders()` mails tomorrow's appointments between 10:00 and 21:00 (only those
booked more than 18 h ahead), from `cron.php` and, as a fallback, from `maybe_send_reminders()` on
panel visits (at most every 15 minutes).

## Billing and the clinical file (stage 3)

`migrations/003_billing_clinical.sql`: `number_sequences`, `invoices`, `invoice_items`, `payments`,
`treatment_plans`, `treatment_plan_items`, `tooth_conditions`, `patient_documents`, `consents`,
`data_requests`, `patients.anonymized_at`, `audit_log.patient_id`.

- Money is integer bani everywhere; totals are computed in `billing.php` and stored. Invoice and
  receipt numbers come from `next_sequence()` inside the issuing transaction (no gaps). Issued
  invoices are cancelled, never deleted; cancelling detaches the payments (credit on account).
- A tooth finding is never edited: a new one resolves the ones it supersedes (history stays).
- Patient files are stored in `storage/documente/` (random names, MIME checked with finfo) and
  served by `/admin/documente/{id}` after the patient-scope check.
- Routes declare who may open them (`null`, `'admin'` or a permission) in `src/admin/routes.php`;
  every page re-checks the patient or clinic scope.
