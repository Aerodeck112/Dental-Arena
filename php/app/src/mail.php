<?php
/**
 * E-mail: through the server's own mail() (works on cPanel without settings), or through an
 * e-mail account over SMTP when config.php has 'smtp' (better delivery to Gmail and Yahoo).
 * A test copy of the site (site_mode = test) only writes the message to the log.
 */
declare(strict_types=1);

function send_mail(string $to, string $subject, string $text, ?string $replyTo = null): bool
{
    $from = CONFIG['mail_from'] ?? 'office@dentalarena.ro';
    $fromName = 'Dental Arena';
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
        if (!empty(CONFIG['smtp']['host'])) {
            smtp_send(CONFIG['smtp'], $from, $to, $encodedSubject, $headers, $body);
            return true;
        }
        $headerLines = implode("\r\n", array_map(static fn ($k, $v) => "{$k}: {$v}", array_keys($headers), $headers));
        $ok = mail($to, $encodedSubject, $body, $headerLines, '-f' . $from);
        if (!$ok) {
            app_log('mail', "mail() a refuzat mesajul către {$to}: {$subject}");
        }
        return $ok;
    } catch (Throwable $e) {
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
    $fp = @stream_socket_client("{$host}:{$port}", $errno, $errstr, 15);
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
