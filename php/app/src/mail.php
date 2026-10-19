<?php
/**
 * E-mail: through the server's own mail() (works on cPanel without settings), or through an
 * e-mail account over SMTP (better delivery to Gmail and Yahoo), set in Setări → Mesaje → E-mail
 * or in config.php ('smtp'). A test copy of the site (site_mode = test) only writes the message to
 * the log. Setări → Mesaje shows how e-mail goes and sends a test message.
 */
declare(strict_types=1);

/**
 * How e-mail leaves: the SMTP account from the panel (its password sealed), else the one in
 * config.php, else PHP mail(); and the sender address.
 *
 * @return array{smtp:?array,from:string,source:string}
 */
function mail_settings(): array
{
    $s = setting('smtp');
    if (is_array($s) && trim((string) ($s['host'] ?? '')) !== '') {
        $s['pass'] = secret_open((string) ($s['pass'] ?? ''));
        return ['smtp' => $s, 'from' => trim((string) ($s['from'] ?? '')) ?: (string) ($s['user'] ?? ''), 'source' => 'panou'];
    }
    if (!empty(CONFIG['smtp']['host'])) {
        return ['smtp' => CONFIG['smtp'], 'from' => CONFIG['mail_from'] ?? (CONFIG['smtp']['user'] ?? 'office@dentalarena.ro'), 'source' => 'config.php'];
    }
    return ['smtp' => null, 'from' => CONFIG['mail_from'] ?? 'office@dentalarena.ro', 'source' => 'mail()'];
}

/** The reason the last e-mail of this request did not leave (for the test in Setări → Mesaje). */
function mail_last_error(?string $set = null): ?string
{
    static $last = null;
    if (func_num_args() > 0) {
        $last = $set;
    }
    return $last;
}

function send_mail(string $to, string $subject, string $text, ?string $replyTo = null): bool
{
    $cfg = mail_settings();
    $from = filter_var($cfg['from'], FILTER_VALIDATE_EMAIL) ? $cfg['from'] : 'office@dentalarena.ro';
    $fromName = 'Dental Arena';
    mail_last_error(null);
    if (is_test_site()) {
        app_log('mail', "[test] către {$to}: {$subject}\n{$text}");
        return true;
    }
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers = [
        'From' => '=?UTF-8?B?' . base64_encode($fromName) . "?= <{$from}>",
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => 'base64',
        'Date' => date('r'),
        'Message-ID' => '<' . bin2hex(random_bytes(12)) . '@' . (parse_url(site_url(), PHP_URL_HOST) ?: 'dentalarena.ro') . '>',
    ];
    if ($replyTo !== null && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $headers['Reply-To'] = $replyTo;
    }
    $body = chunk_split(base64_encode($text));
    try {
        if ($cfg['smtp'] !== null) {
            smtp_send($cfg['smtp'], $from, $to, $encodedSubject, $headers, $body);
            return true;
        }
        if (!function_exists('mail')) {
            throw new RuntimeException('funcția mail() e oprită pe server; folosiți un cont SMTP.');
        }
        $headerLines = implode("\r\n", array_map(static fn ($k, $v) => "{$k}: {$v}", array_keys($headers), $headers));
        $ok = mail($to, $encodedSubject, $body, $headerLines, '-f' . $from);
        if (!$ok) {
            mail_last_error('Serverul (mail()) a refuzat mesajul.');
            app_log('mail', "mail() a refuzat mesajul către {$to}: {$subject}");
        }
        return $ok;
    } catch (Throwable $e) {
        mail_last_error($e->getMessage());
        app_log('mail', "Eroare la trimiterea către {$to}: " . $e->getMessage());
        return false;
    }
}

/** A minimal SMTP client (SSL on 465 or STARTTLS on 587, AUTH LOGIN). */
function smtp_send(array $s, string $from, string $to, string $subject, array $headers, string $body): void
{
    $port = (int) ($s['port'] ?? 465);
    $secure = $s['secure'] ?? ($port === 465 ? 'ssl' : 'tls');
    $host = ($secure === 'ssl' ? 'ssl://' : '') . $s['host'];
    $fp = @stream_socket_client("{$host}:{$port}", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, stream_context_create(['ssl' => ['peer_name' => $s['host'], 'SNI_enabled' => true]]));
    if ($fp === false) {
        throw new RuntimeException("SMTP: nu mă pot conecta la {$s['host']}:{$port} ({$errstr})");
    }
    stream_set_timeout($fp, 15);
    $read = static function () use ($fp): string {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $data;
    };
    $cmd = static function (string $c, array $ok) use ($fp, $read): string {
        fwrite($fp, $c . "\r\n");
        $r = $read();
        if (!in_array((int) substr($r, 0, 3), $ok, true)) {
            throw new RuntimeException('SMTP: ' . trim($r));
        }
        return $r;
    };
    $read();
    $ehlo = 'EHLO ' . (parse_url(site_url(), PHP_URL_HOST) ?: 'localhost');
    $cmd($ehlo, [250]);
    if ($secure === 'tls') {
        $cmd('STARTTLS', [220]);
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new RuntimeException('SMTP: STARTTLS a eșuat');
        }
        $cmd($ehlo, [250]);
    }
    if (trim((string) ($s['user'] ?? '')) === '') {
        throw new RuntimeException('SMTP: lipsește utilizatorul (adresa contului de e-mail).');
    }
    $cmd('AUTH LOGIN', [334]);
    $cmd(base64_encode((string) $s['user']), [334]);
    $cmd(base64_encode((string) $s['pass']), [235]);
    $cmd("MAIL FROM:<{$from}>", [250]);
    $cmd("RCPT TO:<{$to}>", [250, 251]);
    $cmd('DATA', [354]);
    $lines = array_map(static fn ($k, $v) => "{$k}: {$v}", array_keys($headers), $headers);
    $lines[] = "To: {$to}";
    $lines[] = "Subject: {$subject}";
    fwrite($fp, implode("\r\n", $lines) . "\r\n\r\n" . $body . "\r\n.\r\n");
    $r = $read();
    if ((int) substr($r, 0, 3) !== 250) {
        throw new RuntimeException('SMTP: ' . trim($r));
    }
    fwrite($fp, "QUIT\r\n");
    fclose($fp);
}
