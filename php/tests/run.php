<?php
/**
 * Checks of the PHP code that needs no database: legal holidays, doctors' schedules (with the
 * break), the free intervals, the signature check of the tablet, and the Anthropic SDK contract
 * the site's chat relies on (tool calls and thinking blocks sent back unchanged). Run: php php/tests/run.php
 */
declare(strict_types=1);

const APP_DIR = __DIR__ . '/../app';
require APP_DIR . '/src/booking.php';
require APP_DIR . '/src/admin/kiosk.php';
require APP_DIR . '/src/helpers.php';

$failed = 0;
$check = static function (string $what, bool $ok) use (&$failed): void {
    echo ($ok ? 'ok   ' : 'FAIL ') . $what . "\n";
    $failed += $ok ? 0 : 1;
};

// Orthodox Easter: 2025-04-20, 2026-04-12, 2027-05-02; Pentecost Monday 2026-06-01 (also Children's Day).
$check('Paște 2025', in_array('2025-04-20', ro_holidays(2025), true) && in_array('2025-04-21', ro_holidays(2025), true));
$check('Paște 2026 + Vinerea Mare', in_array('2026-04-12', ro_holidays(2026), true) && in_array('2026-04-10', ro_holidays(2026), true));
$check('Paște 2027', in_array('2027-05-02', ro_holidays(2027), true));
$check('Rusalii 2026', in_array('2026-05-31', ro_holidays(2026), true) && in_array('2026-06-01', ro_holidays(2026), true));
$check('Crăciun, Ziua națională', in_array('2026-12-25', ro_holidays(2026), true) && in_array('2026-12-01', ro_holidays(2026), true));
$check('o zi obișnuită nu e sărbătoare', !in_array('2026-10-14', ro_holidays(2026), true));

$sch = schedule_decode('{"1":["09:00","17:00"],"2":["09:00","17:00"],"3":["09:00","17:00"],"5":["10:00","14:00"],"6":["12:00","10:00"],"9":["09:00","10:00"]}');
$check('programul ignoră intervale greșite', array_keys($sch) === [1, 2, 3, 5]);
$check('programul în cuvinte', schedule_text($sch) === 'Luni–Miercuri 09:00–17:00, Vineri 10:00–14:00');
$brk = schedule_decode('{"1":["09:00","17:00","13:00","14:00"],"2":["09:00","17:00","18:00","19:00"],"3":["09:00","17:00","13:00"]}');
$check('pauza din program', $brk[1] === ['09:00', '17:00', '13:00', '14:00'] && $brk[2] === ['09:00', '17:00'] && !isset($brk[3]));
$check('programul cu pauză în cuvinte', schedule_text($brk) === 'Luni 09:00–17:00 (pauză 13:00–14:00), Marți 09:00–17:00');
$check('intervale fără pauză și absențe', intervals_subtract([[540, 1020]], [[780, 840], [1000, 1100]]) === [[540, 780], [840, 1000]]);
$check('ziua în cuvinte', day_label('2026-10-14') === 'miercuri, 14 octombrie');

$check('numerele în română', count_ro(1, 'o programare', 'programări') === 'o programare' && count_ro(5, 'o programare', 'programări') === '5 programări'
    && count_ro(20, 'o programare', 'programări') === '20 de programări' && count_ro(101, 'o programare', 'programări') === '101 programări' && count_ro(120, 'o programare', 'programări') === '120 de programări');

if (function_exists('imagecreatetruecolor')) {
    $img = imagecreatetruecolor(600, 200);
    imagefill($img, 0, 0, imagecolorallocate($img, 255, 255, 255));
    ob_start();
    imagepng($img);
    $check('semnătura goală e refuzată', !signature_has_ink((string) ob_get_clean()));
    imagesetthickness($img, 4);
    imageline($img, 20, 60, 580, 160, imagecolorallocate($img, 10, 20, 30));
    ob_start();
    imagepng($img);
    $check('semnătura cu linii e primită', signature_has_ink((string) ob_get_clean()));
}

if (is_file(APP_DIR . '/vendor/autoload.php')) {
    require APP_DIR . '/vendor/autoload.php';
    $fake = new class implements Psr\Http\Client\ClientInterface {
        public string $sent = '';
        public function sendRequest(Psr\Http\Message\RequestInterface $r): Psr\Http\Message\ResponseInterface
        {
            $this->sent = (string) $r->getBody();
            return new GuzzleHttp\Psr7\Response(200, ['content-type' => 'application/json'], (string) json_encode([
                'id' => 'msg_1', 'type' => 'message', 'role' => 'assistant', 'model' => 'claude-sonnet-5-5', 'stop_reason' => 'tool_use', 'stop_sequence' => null,
                'content' => [['type' => 'thinking', 'thinking' => 'x', 'signature' => 'sig'], ['type' => 'tool_use', 'id' => 'toolu_1', 'name' => 'cauta_ore_libere', 'input' => ['clinica' => 'ludus']]],
                'usage' => ['input_tokens' => 10, 'output_tokens' => 5, 'cache_read_input_tokens' => 7],
            ]));
        }
    };
    $client = new Anthropic\Client(apiKey: 'test', requestOptions: ['transporter' => $fake, 'maxRetries' => 0]);
    $msg = $client->beta->messages->create(maxTokens: 64, model: 'claude-sonnet-5-5', messages: [['role' => 'user', 'content' => 'salut']],
        tools: [['name' => 'cauta_ore_libere', 'description' => 'd', 'inputSchema' => ['type' => 'object', 'properties' => ['clinica' => ['type' => 'string']]]]],
        system: [['type' => 'text', 'text' => 'reguli', 'cacheControl' => ['type' => 'ephemeral']]]);
    $first = json_decode($fake->sent, true);
    $check('SDK: unelte și cache în cerere', ($first['tools'][0]['input_schema']['type'] ?? '') === 'object' && ($first['system'][0]['cache_control']['type'] ?? '') === 'ephemeral');
    $blocks = array_map(static fn ($b) => json_decode((string) json_encode($b), true), $msg->content);
    $check('SDK: răspunsul cu tool_use', $msg->stopReason === 'tool_use' && $msg->content[1]->name === 'cauta_ore_libere' && $msg->usage->cacheReadInputTokens === 7);
    $client->beta->messages->create(maxTokens: 64, model: 'claude-sonnet-5-5', messages: [
        ['role' => 'user', 'content' => 'salut'],
        ['role' => 'assistant', 'content' => $blocks],
        ['role' => 'user', 'content' => [['type' => 'tool_result', 'tool_use_id' => 'toolu_1', 'content' => '{"ok":true}']]],
    ]);
    $second = json_decode($fake->sent, true);
    $check('SDK: gândirea se trimite înapoi neschimbată', $second['messages'][1]['content'][0] === ['type' => 'thinking', 'signature' => 'sig', 'thinking' => 'x']);
    $check('SDK: rezultatul uneltei', $second['messages'][2]['content'][0]['tool_use_id'] === 'toolu_1');
} else {
    echo "skip SDK (fără dentalarena/vendor: rulați composer install în php/app)\n";
}

// The doctor's morning programme: from their hour, for 3 hours; not at 17:34 (October 2026).
require_once APP_DIR . '/src/notify.php';
$doc = ['agenda_time' => '07:00'];
$check('programul zilei: la 09:30 încă pleacă', !agenda_window_passed($doc, new DateTimeImmutable('2026-10-20 09:30')));
$check('programul zilei: la 10:00 fix încă pleacă', !agenda_window_passed($doc, new DateTimeImmutable('2026-10-20 10:00')));
$check('programul zilei: la 17:34 nu mai pleacă', agenda_window_passed($doc, new DateTimeImmutable('2026-10-20 17:34')));
$check('programul zilei: ora goală = 07:00', agenda_window_passed(['agenda_time' => ''], new DateTimeImmutable('2026-10-20 10:01')));

echo $failed === 0 ? "\nToate verificările au trecut.\n" : "\n{$failed} verificări au eșuat.\n";
exit($failed === 0 ? 0 : 1);
