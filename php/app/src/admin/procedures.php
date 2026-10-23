<?php
/**
 * The procedures done for a patient and what was paid for them (as in QDental): each doctor adds
 * what they did, with the price from the price list (it can be changed, or given a discount);
 * reception takes the payments. A payment is spread over the procedures not yet paid, the oldest
 * first; what is left over is an advance, used by the next procedure. Separate from the invoices.
 * An account with its own ledger keeps what it enters apart (ledger_users()).
 */
declare(strict_types=1);

const PROC_PAY_METHODS = ['numerar' => 'Numerar', 'card' => 'Card', 'transfer' => 'Transfer (OP)', 'altele' => 'Altă plată', 'qdental' => 'Din QDental'];

/** What the patient owes for a procedure (its price minus the discount; nothing while not done). */
function procedure_due(array $p): int
{
    return (int) $p['done'] === 1 ? max(0, (int) $p['price'] - (int) $p['discount']) : 0;
}

/**
 * The accounts with their own ledger (Utilizatori → „Registru separat”): what they enter (the
 * procedures they add, the payments they take) stays in their ledger. „Luduș 2”, or a doctor who
 * bills and collects himself. id → name.
 *
 * @return array<int,string>
 */
function ledger_users(): array
{
    static $all = null;
    return $all ??= array_map('strval', array_column(db_all('SELECT id, name FROM users WHERE own_ledger = 1 ORDER BY name'), 'name', 'id'));
}

function ledger_label(?int $ledger): string
{
    return $ledger === null || $ledger === 0 ? 'Registrul comun' : 'Registrul ' . (ledger_users()[$ledger] ?? "#{$ledger}");
}

/**
 * What part of the procedures and payments an account works with: from = the day its history
 * starts (history_from), ledger = null for all (administrators; $ask narrows it: „comun” or an
 * account's id), 0 for the common ledger, an account id for that account's own.
 *
 * @return array{from:?string,ledger:?int}
 */
function proc_scope(array $user, string $ask = ''): array
{
    if (!is_admin($user)) {
        return ['from' => history_from($user), 'ledger' => (int) ($user['own_ledger'] ?? 0) === 1 ? (int) $user['id'] : 0];
    }
    $ledger = match (true) {
        $ask === 'comun' => 0,
        $ask !== '' && isset(ledger_users()[(int) $ask]) => (int) $ask,
        default => null,
    };
    return ['from' => null, 'ledger' => $ledger];
}

/** The scope as SQL („ AND …”) on a table alias, with $dateCol for the day. @return array{0:string,1:list<mixed>} */
function proc_scope_sql(array $scope, string $alias, string $dateCol): array
{
    $sql = '';
    $params = [];
    if (($scope['from'] ?? null) !== null) {
        $sql .= " AND {$alias}.{$dateCol} >= ?";
        $params[] = $scope['from'];
    }
    if (($scope['ledger'] ?? null) === 0) {
        $sql .= " AND {$alias}.ledger_user_id IS NULL";
    } elseif (($scope['ledger'] ?? null) !== null) {
        $sql .= " AND {$alias}.ledger_user_id = ?";
        $params[] = (int) $scope['ledger'];
    }
    return [$sql, $params];
}

/**
 * A patient's procedures in the scope (proc_scope), newest first, each with what was paid for it.
 *
 * @return list<array>
 */
function patient_procedures(int $patientId, array $scope = []): array
{
    [$where, $params] = proc_scope_sql($scope, 'p', 'performed_on');
    return db_all(
        'SELECT p.*, d.public_name AS doctor, l.short_name AS clinic,
            COALESCE((SELECT SUM(i.amount) FROM procedure_payment_items i JOIN procedure_payments pp ON pp.id = i.payment_id WHERE i.procedure_id = p.id AND pp.cancelled_at IS NULL), 0) AS paid
         FROM procedures p LEFT JOIN doctors d ON d.id = p.doctor_id LEFT JOIN locations l ON l.id = p.location_id
         WHERE p.patient_id = ?' . $where . ' ORDER BY p.performed_on DESC, p.id DESC',
        array_merge([$patientId], $params),
    );
}

/** @return array{total:int,paid:int,rest:int,advance:int,lab:int,count:int} */
function procedures_summary(int $patientId, array $scope = []): array
{
    $rows = patient_procedures($patientId, $scope);
    $total = array_sum(array_map('procedure_due', $rows));
    // Paid over a procedure's price (it happened in QDental) counts as advance.
    $paidOn = array_sum(array_map(static fn ($p) => min((int) $p['paid'], procedure_due($p)), $rows));
    [$where, $params] = proc_scope_sql($scope, 'pp', 'paid_on');
    $payments = (int) db_value('SELECT COALESCE(SUM(pp.amount), 0) FROM procedure_payments pp WHERE pp.patient_id = ? AND pp.cancelled_at IS NULL' . $where, array_merge([$patientId], $params));
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
 * oldest first. Call it inside the transaction that changed a procedure or a payment. Each ledger
 * on its own: a payment goes only to procedures of its ledger. With a scope (an account that
 * starts from zero) only its payments and procedures, since its day.
 */
function procedures_allocate(int $patientId, array $scope = []): void
{
    $ledgers = ($scope['ledger'] ?? null) !== null ? [(int) $scope['ledger']]
        : array_map('intval', array_column(db_all('SELECT DISTINCT COALESCE(ledger_user_id, 0) AS l FROM procedure_payments WHERE patient_id = ? AND cancelled_at IS NULL', [$patientId]), 'l'));
    foreach ($ledgers as $ledger) {
        $one = ['from' => $scope['from'] ?? null, 'ledger' => $ledger];
        [$where, $params] = proc_scope_sql($one, 'p', 'paid_on');
        $free = [];
        foreach (db_all('SELECT p.id, p.amount - COALESCE((SELECT SUM(i.amount) FROM procedure_payment_items i WHERE i.payment_id = p.id), 0) AS left_over FROM procedure_payments p WHERE p.patient_id = ? AND p.cancelled_at IS NULL' . $where . ' ORDER BY p.paid_on, p.id FOR UPDATE', array_merge([$patientId], $params)) as $r) {
            if ((int) $r['left_over'] > 0) {
                $free[] = ['id' => (int) $r['id'], 'left' => (int) $r['left_over']];
            }
        }
        if ($free === []) {
            continue;
        }
        foreach (array_reverse(patient_procedures($patientId, $one)) as $proc) {
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
}

/**
 * The ledger of what an account enters now: its own; the common one for the others; an
 * administrator chooses ($ask: „comun”, an account's id, or „medic”: the ledger of the doctor's
 * account, when that has its own).
 */
function proc_new_ledger(array $user, string $ask = 'comun', ?int $doctorId = null): ?int
{
    if (!is_admin($user)) {
        return (int) ($user['own_ledger'] ?? 0) === 1 ? (int) $user['id'] : null;
    }
    if ($ask === 'medic') {
        $id = $doctorId !== null ? db_value('SELECT id FROM users WHERE doctor_id = ? AND own_ledger = 1 AND active = 1 ORDER BY id LIMIT 1', [$doctorId]) : null;
        return $id !== null && $id !== false ? (int) $id : null;
    }
    return isset(ledger_users()[(int) $ask]) ? (int) $ask : null;
}

/**
 * „Registru separat” switched on for an account linked to a doctor: the doctor's procedures at
 * the account's clinics still in the common ledger, and the payments only on them, go to the
 * account's ledger. Returns how many procedures moved.
 */
function ledger_take_doctor_history(int $userId, int $doctorId, array $locationIds): int
{
    if ($locationIds === []) {
        return 0;
    }
    $in = implode(',', array_map('intval', $locationIds));
    $patients = array_map('intval', array_column(db_all("SELECT DISTINCT patient_id FROM procedures WHERE doctor_id = ? AND ledger_user_id IS NULL AND location_id IN ({$in})", [$doctorId]), 'patient_id'));
    $n = db_run("UPDATE procedures SET ledger_user_id = ? WHERE doctor_id = ? AND ledger_user_id IS NULL AND location_id IN ({$in})", [$userId, $doctorId]);
    db_run('UPDATE procedure_payments pp SET pp.ledger_user_id = ? WHERE pp.ledger_user_id IS NULL
        AND EXISTS (SELECT 1 FROM procedure_payment_items i JOIN procedures pr ON pr.id = i.procedure_id WHERE i.payment_id = pp.id AND pr.ledger_user_id = ?)
        AND NOT EXISTS (SELECT 1 FROM procedure_payment_items i JOIN procedures pr ON pr.id = i.procedure_id WHERE i.payment_id = pp.id AND (pr.ledger_user_id IS NULL OR pr.ledger_user_id <> ?))', [$userId, $userId, $userId]);
    // A payment of the common ledger that was on one of these procedures goes back to its ledger.
    foreach ($patients as $pid) {
        db_run('DELETE i FROM procedure_payment_items i JOIN procedure_payments pp ON pp.id = i.payment_id JOIN procedures pr ON pr.id = i.procedure_id
            WHERE pp.patient_id = ? AND COALESCE(pp.ledger_user_id, 0) <> COALESCE(pr.ledger_user_id, 0)', [$pid]);
        procedures_allocate($pid);
    }
    return $n;
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

/**
 * The clinics' own price lists (Servicii și prețuri → „Lista de prețuri a clinicii”), the active
 * services by name. A clinic with a list gets it at „Adaugă procedură” instead of the site's.
 *
 * @return array<int,array<int,array{name:string,price:?int}>> clinic id → service id → service
 */
function clinic_service_lists(): array
{
    $out = [];
    foreach (db_all('SELECT id, location_id, name, price FROM clinic_services WHERE active = 1 ORDER BY name, id') as $r) {
        $out[(int) $r['location_id']][(int) $r['id']] = ['name' => $r['name'], 'price' => $r['price'] !== null ? (int) $r['price'] : null];
    }
    return $out;
}
