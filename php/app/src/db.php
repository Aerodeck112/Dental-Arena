<?php
/**
 * The MySQL database (the one created in cPanel → MySQL Databases). Every query goes through
 * prepared statements. migrate() applies the files in migrations/ that have not run yet, in
 * order, so an update of the site also updates the tables.
 */
declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = CONFIG['db'] ?? [];
        $pdo = db_connect($c['host'] ?? 'localhost', $c['name'] ?? '', $c['user'] ?? '', $c['pass'] ?? '', (int) ($c['port'] ?? 3306));
    }
    return $pdo;
}

function db_connect(string $host, string $name, string $user, string $pass, int $port = 3306): PDO
{
    $pdo = new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '" . (new DateTimeImmutable())->format('P') . "', sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'");
    return $pdo;
}

/** @return list<array<string,mixed>> */
function db_all(string $sql, array $params = []): array
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st->fetchAll();
}

/** @return array<string,mixed>|null */
function db_one(string $sql, array $params = []): ?array
{
    $st = db()->prepare($sql);
    $st->execute($params);
    $row = $st->fetch();
    return $row === false ? null : $row;
}

function db_value(string $sql, array $params = []): mixed
{
    $st = db()->prepare($sql);
    $st->execute($params);
    $v = $st->fetchColumn();
    return $v === false ? null : $v;
}

/** Runs an INSERT/UPDATE/DELETE; returns the affected rows. */
function db_run(string $sql, array $params = []): int
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st->rowCount();
}

function db_insert(string $table, array $row): int
{
    $cols = array_keys($row);
    $sql = sprintf(
        'INSERT INTO `%s` (%s) VALUES (%s)',
        $table,
        implode(', ', array_map(static fn ($c) => "`{$c}`", $cols)),
        implode(', ', array_map(static fn ($c) => ":{$c}", $cols)),
    );
    db_run($sql, $row);
    return (int) db()->lastInsertId();
}

function db_update(string $table, array $row, string $where, array $params = []): int
{
    $set = implode(', ', array_map(static fn ($c) => "`{$c}` = :set_{$c}", array_keys($row)));
    $bind = [];
    foreach ($row as $k => $v) {
        $bind["set_{$k}"] = $v;
    }
    return db_run("UPDATE `{$table}` SET {$set} WHERE {$where}", $bind + $params);
}

function db_tx(callable $fn): mixed
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $result = $fn();
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function now_sql(): string
{
    return date('Y-m-d H:i:s');
}

/** Applies the migrations not yet applied; returns how many ran. */
function migrate(?PDO $pdo = null): int
{
    $pdo ??= db();
    $pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) PRIMARY KEY, applied_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    $done = array_flip($pdo->query('SELECT name FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN));
    $files = glob(APP_DIR . '/migrations/*.sql') ?: [];
    sort($files);
    $ran = 0;
    foreach ($files as $file) {
        $name = basename($file);
        if (isset($done[$name])) {
            continue;
        }
        // MySQL commits DDL on its own, so each statement runs separately.
        foreach (split_sql((string) file_get_contents($file)) as $statement) {
            $pdo->exec($statement);
        }
        $pdo->prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')->execute([$name, now_sql()]);
        $ran++;
    }
    return $ran;
}

/** @return list<string> the statements of an SQL file (no semicolons inside strings in our files). */
function split_sql(string $sql): array
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? '';
    return array_values(array_filter(array_map('trim', explode(';', $sql)), static fn ($s) => $s !== ''));
}
