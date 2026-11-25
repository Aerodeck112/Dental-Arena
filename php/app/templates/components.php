<?php
/** Loads the template components (the PHP counterparts of src/components/site). */
declare(strict_types=1);

require __DIR__ . '/layout.php';
foreach (['ui', 'chrome', 'blocks', 'fields'] as $file) {
    require __DIR__ . "/components/{$file}.php";
}
