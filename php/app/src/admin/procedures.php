<?php
/**
 * The procedures done for a patient and what was paid for them (as in QDental): each doctor adds
 * what they did, with the price from the price list (it can be changed, or given a discount);
 * reception takes the payments. A payment is spread over the procedures not yet paid, the oldest
 * first; what is left over is an advance, used by the next procedure. Separate from the invoices.
 */
declare(strict_types=1);

const PROC_PAY_METHODS = ['numerar' => 'Numerar', 'card' => 'Card', 'transfer' => 'Transfer (OP)', 'altele' => 'Altă plată', 'qdental' => 'Din QDental'];

/** What the patient owes for a procedure (its price minus the discount; nothing while not done). */
function procedure_due(array $p): int
{
    return (int) $p['done'] === 1 ? max(0, (int) $p['price'] - (int) $p['discount']) : 0;
}

/**
 * A patient's procedures, newest first, each with what was paid for it; with $from (an account
 * that starts from zero, history_from()) only those done since that day.
 *
 * @return list<array>
 */
function patient_procedures(int $patientId, ?string $from = null): array
{
    return db_all(
        'SELECT p.*, d.public_name AS doctor, l.short_name AS clinic,
            COALESCE((SELECT SUM(i.amount) FROM procedure_payment_items i JOIN procedure_payments pp ON pp.id = i.payment_id WHERE i.procedure_id = p.id AND pp.cancelled_at IS NULL), 0) AS paid
         FROM procedures p LEFT JOIN doctors d ON d.id = p.doctor_id LEFT JOIN locations l ON l.id = p.location_id
         WHERE p.patient_id = ?' . ($from !== null ? ' AND p.performed_on >= ?' : '') . ' ORDER BY p.performed_on DESC, p.id DESC',
        $from !== null ? [$patientId, $from] : [$patientId],
    );
}

/** @return array{total:int,paid:int,rest:int,advance:int,lab:int,count:int} */
function procedures_summary(int $patientId, ?string $from = null): array
{
    $rows = patient_procedures($patientId, $from);
    $total = array_sum(array_map('procedure_due', $rows));
    // Paid over a procedure's price (it happened in QDental) counts as advance.
    $paidOn = array_sum(array_map(static fn ($p) => min((int) $p['paid'], procedure_due($p)), $rows));
    $payments = (int) db_value('SELECT COALESCE(SUM(amount), 0) FROM procedure_payments WHERE patient_id = ? AND cancelled_at IS NULL' . ($from !== null ? ' AND paid_on >= ?' : ''), $from !== null ? [$patientId, $from] : [$patientId]);
    return [
        'total' => $total,
        'paid' => $paidOn,
        'rest' => max(0, $total - $paidOn),
        'advance' => max(0, $payments - $paidOn),
        'lab' => array_sum(array_map(static fn ($p) => (int) $p['lab_cost'], $rows)),
        'count' => count($rows),
    ];
}

/**
 * Spreads what a patient paid and is not yet on a procedure over the procedures not yet paid, the
 * oldest first. Call it inside the transaction that changed a procedure or a payment. With $from
 * (an account that starts from zero) only its payments and procedures, since that day: a payment
 * taken there does not go to a debt it cannot see.
 */
function procedures_allocate(int $patientId, ?string $from = null): void
{
    $free = [];
    foreach (db_all('SELECT p.id, p.amount - COALESCE((SELECT SUM(i.amount) FROM procedure_payment_items i WHERE i.payment_id = p.id), 0) AS left_over FROM procedure_payments p WHERE p.patient_id = ? AND p.cancelled_at IS NULL' . ($from !== null ? ' AND p.paid_on >= ?' : '') . ' ORDER BY p.paid_on, p.id FOR UPDATE', $from !== null ? [$patientId, $from] : [$patientId]) as $r) {
        if ((int) $r['left_over'] > 0) {
            $free[] = ['id' => (int) $r['id'], 'left' => (int) $r['left_over']];
        }
    }
    if ($free === []) {
        return;
    }
    foreach (array_reverse(patient_procedures($patientId, $from)) as $proc) {
        $owed = procedure_due($proc) - (int) $proc['paid'];
        while ($owed > 0 && $free !== []) {
            $take = min($owed, $free[0]['left']);
            db_run('INSERT INTO procedure_payment_items (payment_id, procedure_id, amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount = amount + VALUES(amount)', [$free[0]['id'], (int) $proc['id'], $take]);
            $owed -= $take;
            $free[0]['left'] -= $take;
            if ($free[0]['left'] === 0) {
                array_shift($free);
            }
        }
    }
}

/** A procedure's state, in words and colour: paid, partly paid, not paid, not done yet. */
function procedure_state_chip(array $p): string
{
    $due = procedure_due($p);
    [$label, $cls] = match (true) {
        (int) $p['done'] !== 1 => ['Neefectuată', 'border border-dashed border-linie-control text-discret'],
        $due === 0 => ['Fără plată', 'bg-adancit text-discret'],
        (int) $p['paid'] >= $due => ['Achitată', 'bg-menta-pal text-cerneala'],
        (int) $p['paid'] > 0 => ['Achitată parțial', 'bg-portocaliu-pal text-portocaliu'],
        default => ['Neachitată', 'bg-carmin-pal text-carmin'],
    };
    return '<span class="' . e(cn('inline-flex items-center whitespace-nowrap rounded-chip px-2.5 py-0.5 text-mic font-medium', $cls)) . '">' . e($label) . '</span>';
}

/**
 * The prices approved at each clinic (Servicii și prețuri → „Preț aprobat în clinică”), in bani.
 *
 * @param list<int>|null $serviceIds null for all
 * @return array<int,array<int,int>> service id → clinic id → price
 */
function service_clinic_prices(?array $serviceIds = null): array
{
    if ($serviceIds === []) {
        return [];
    }
    $out = [];
    foreach (db_all('SELECT service_id, location_id, price FROM service_clinic_prices' . ($serviceIds !== null ? ' WHERE service_id IN (' . implode(',', array_map('intval', $serviceIds)) . ')' : '')) as $r) {
        $out[(int) $r['service_id']][(int) $r['location_id']] = (int) $r['price'];
    }
    return $out;
}

/**
 * The price list for the „Procedura” field: services grouped by their page, with the site price
 * and the price of each clinic (the form takes the one of the chosen clinic).
 */
function procedure_price_options(): array
{
    $out = [];
    $clinic = service_clinic_prices();
    foreach (db_all('SELECT s.id, s.name, s.price_min, c.name AS category FROM services s JOIN categories c ON c.id = s.category_id ORDER BY c.sort_order, s.sort_order, s.id') as $s) {
        $out[$s['category']][(int) $s['id']] = ['name' => $s['name'], 'price' => $s['price_min'] !== null ? (int) $s['price_min'] : null, 'clinics' => $clinic[(int) $s['id']] ?? []];
    }
    return $out;
}
