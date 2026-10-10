<?php
/**
 * The panel's accounts. Three roles: administrator (everything), recepție and medic (the requests
 * of the clinics ticked on their account, and their own password). Passwords are stored with
 * password_hash; ten wrong passwords in 15 minutes lock the login for that address and network.
 */
declare(strict_types=1);

const ROLES = ['admin' => 'Administrator', 'receptie' => 'Recepție', 'medic' => 'Medic'];
/** What each role may do beyond the clinics ticked on the account. */
const PERMISSIONS = [
    'medical' => ['admin', 'medic'],          // anamneza, odontograma, note clinice
    'plans.manage' => ['admin', 'medic'],     // planuri de tratament (recepția le vede, pentru facturare)
    'billing' => ['admin', 'receptie'],       // facturi și încasări
    'billing.cancel' => ['admin'],
    'documents.delete' => ['admin'],
    'reports.finance' => ['admin'],
    'gdpr' => ['admin'],
    'audit' => ['admin'],
];

function can(string $permission, ?array $user = null): bool
{
    $user ??= current_user();
    return $user !== null && in_array($user['role'], PERMISSIONS[$permission] ?? ['admin'], true);
}

const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MINUTES = 15;

function current_user(): ?array
{
    static $user = false;
    if ($user !== false) {
        return $user;
    }
    session_begin();
    $id = $_SESSION['user_id'] ?? null;
    $user = null;
    if ($id) {
        $row = db_one('SELECT * FROM users WHERE id = ? AND active = 1', [$id]);
        // A password change ends the other sessions of the account.
        if ($row && hash_equals((string) ($_SESSION['pw'] ?? ''), substr($row['password_hash'], -16))) {
            $row['locationIds'] = array_map('intval', array_column(db_all('SELECT location_id FROM user_locations WHERE user_id = ?', [$row['id']]), 'location_id'));
            $user = $row;
        } else {
            unset($_SESSION['user_id'], $_SESSION['pw']);
        }
    }
    return $user;
}

function is_admin(?array $u = null): bool
{
    $u ??= current_user();
    return $u !== null && $u['role'] === 'admin';
}

/** The clinic ids a user may see: all for an administrator, else the ticked ones. */
function allowed_location_ids(?array $u = null): array
{
    $u ??= current_user();
    if ($u === null) {
        return [];
    }
    if (is_admin($u)) {
        return array_map('intval', array_column(db_all('SELECT id FROM locations'), 'id'));
    }
    return $u['locationIds'];
}

/** Sends a visitor without an account to the login page; a user without the right role to the panel's start. */
function require_login(bool $adminOnly = false): array
{
    $u = current_user();
    if ($u === null) {
        redirect('/admin/intrare?inapoi=' . rawurlencode($_SERVER['REQUEST_URI'] ?? '/admin'));
    }
    if ((int) $u['must_change_password'] === 1 && request_path() !== '/admin/cont' && request_path() !== '/admin/iesire') {
        flash('Alegeți o parolă nouă înainte de a continua.', 'info');
        redirect('/admin/cont');
    }
    if ($adminOnly && !is_admin($u)) {
        flash('Pagina este doar pentru administratori.', 'eroare');
        redirect('/admin');
    }
    return $u;
}

/** @return string|null an error message, or null when logged in */
function attempt_login(string $email, string $password): ?string
{
    $email = mb_strtolower(trim($email));
    $ip = client_ip_hash();
    $since = date('Y-m-d H:i:s', time() - LOGIN_WINDOW_MINUTES * 60);
    $tries = (int) db_value('SELECT COUNT(*) FROM login_attempts WHERE (ip_hash = ? OR email = ?) AND created_at > ?', [$ip, $email, $since]);
    if ($tries >= LOGIN_MAX_ATTEMPTS) {
        return 'Prea multe încercări. Așteptați ' . LOGIN_WINDOW_MINUTES . ' minute și încercați din nou.';
    }
    $user = db_one('SELECT * FROM users WHERE email = ? AND active = 1', [$email]);
    if ($user === null || !password_verify($password, $user['password_hash'])) {
        db_insert('login_attempts', ['email' => $email, 'ip_hash' => $ip, 'created_at' => now_sql()]);
        // The same work whether or not the account exists.
        if ($user === null) {
            password_verify($password, password_hash('fara-cont', PASSWORD_DEFAULT));
        }
        return 'E-mailul sau parola nu sunt corecte.';
    }
    if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
        $user['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        db_update('users', ['password_hash' => $user['password_hash']], 'id = :id', ['id' => $user['id']]);
    }
    session_begin();
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['pw'] = substr($user['password_hash'], -16);
    db_update('users', ['last_login_at' => now_sql()], 'id = :id', ['id' => $user['id']]);
    db_run('DELETE FROM login_attempts WHERE email = ? OR created_at < ?', [$email, $since]);
    audit('autentificare', $email, (int) $user['id']);
    return null;
}

function logout(): void
{
    session_begin();
    $_SESSION = [];
    session_regenerate_id(true);
}

/** Sets a password and keeps the current session (other sessions of the account end). */
function set_password(int $userId, string $password, bool $mustChange = false): void
{
    $hash = password_hash($password, PASSWORD_DEFAULT);
    db_update('users', ['password_hash' => $hash, 'must_change_password' => $mustChange ? 1 : 0], 'id = :id', ['id' => $userId]);
    session_begin();
    if ((int) ($_SESSION['user_id'] ?? 0) === $userId) {
        $_SESSION['pw'] = substr($hash, -16);
    }
}

function password_problem(string $password): ?string
{
    if (mb_strlen($password) < 10) {
        return 'Parola trebuie să aibă cel puțin 10 caractere.';
    }
    if (in_array(mb_strtolower($password), ['parola-demo-2026', 'dentalarena', '1234567890', 'parola1234'], true)) {
        return 'Alegeți o parolă mai greu de ghicit.';
    }
    return null;
}

function audit(string $action, string $detail = '', ?int $userId = null, ?int $patientId = null): void
{
    try {
        $row = ['user_id' => $userId ?? (current_user()['id'] ?? null), 'action' => $action, 'detail' => mb_substr($detail, 0, 2000), 'created_at' => now_sql()];
        if ($patientId !== null) {
            $row['patient_id'] = $patientId;
        }
        db_insert('audit_log', $row);
    } catch (Throwable $e) {
        app_log('warning', 'audit: ' . $e->getMessage());
    }
}
