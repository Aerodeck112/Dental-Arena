<?php
/**
 * Form fields with the markup of src/components/ui (TextField, TextArea, Select, RadioGroup,
 * ConsentCheckbox, ErrorSummary): label, optional hint, error under the field, aria-invalid and
 * aria-describedby wired. Used by the public forms and the panel.
 */
declare(strict_types=1);

function input_classes(string $extra = ''): string
{
    return cn(
        'block w-full rounded-control border border-linie-control bg-suprafata px-3.5 text-control text-cerneala',
        'placeholder:text-discret',
        'transition-colors duration-150 ease-filet hover:border-cerneala',
        'aria-[invalid=true]:border-2 aria-[invalid=true]:border-carmin',
        'disabled:cursor-not-allowed disabled:border-linie-control disabled:bg-adancit disabled:text-discret',
        'read-only:bg-adancit',
        $extra,
    );
}

function field_error(string $id, ?string $error): string
{
    if ($error === null || $error === '') {
        return '';
    }
    return '<div id="' . e($id) . '" class="flex flex-col gap-0.5"><p class="flex items-start gap-1.5 text-mic font-medium text-carmin">'
        . icon('alert-triangle', 16, 'mt-[0.2em]') . '<span><span class="sr-only">Eroare: </span>' . e($error) . '</span></p></div>';
}

/**
 * A labelled input. $o: type, value, required, optional, hint, error, autocomplete, inputmode,
 * maxlength, min, max, placeholder, class, attrs (extra attributes).
 */
function text_field(string $name, string $label, array $o = []): string
{
    $id = $o['id'] ?? "field-{$name}";
    $error = $o['error'] ?? null;
    $describedBy = trim((!empty($o['hint']) ? "{$id}-hint " : '') . ($error ? "{$id}-error" : ''));
    $type = $o['type'] ?? 'text';
    $attrs = [
        'type' => $type,
        'id' => $id,
        'name' => $name,
        'value' => $o['value'] ?? '',
        'required' => !empty($o['required']),
        'autocomplete' => $o['autocomplete'] ?? null,
        'inputmode' => $o['inputmode'] ?? ($type === 'tel' ? 'tel' : ($type === 'email' ? 'email' : null)),
        'maxlength' => $o['maxlength'] ?? null,
        'min' => $o['min'] ?? null,
        'max' => $o['max'] ?? null,
        'step' => $o['step'] ?? null,
        'placeholder' => $o['placeholder'] ?? null,
        'aria-invalid' => $error ? 'true' : null,
        'aria-describedby' => $describedBy !== '' ? $describedBy : null,
        'class' => input_classes(cn('h-control', $type === 'tel' ? 'cifre' : '', $o['inputClass'] ?? '')),
    ] + ($o['attrs'] ?? []);
    return '<div class="' . e(cn('flex flex-col gap-1.5', $o['class'] ?? '')) . '">'
        . field_label($id, $label, !empty($o['optional']))
        . (!empty($o['hint']) ? '<p id="' . e($id) . '-hint" class="-mt-0.5 text-mic text-discret">' . e($o['hint']) . '</p>' : '')
        . '<input' . html_attrs($attrs) . '>'
        . field_error("{$id}-error", $error)
        . '</div>';
}

function field_label(string $id, string $label, bool $optional = false): string
{
    return '<label for="' . e($id) . '" class="text-control font-medium text-cerneala">' . e($label)
        . ($optional ? '<span class="font-normal text-discret"> (opțional)</span>' : '') . '</label>';
}

function text_area(string $name, string $label, array $o = []): string
{
    $id = $o['id'] ?? "field-{$name}";
    $error = $o['error'] ?? null;
    $describedBy = trim((!empty($o['hint']) ? "{$id}-hint " : '') . ($error ? "{$id}-error" : ''));
    $attrs = [
        'id' => $id,
        'name' => $name,
        'rows' => $o['rows'] ?? 5,
        'required' => !empty($o['required']),
        'maxlength' => $o['maxlength'] ?? null,
        'aria-invalid' => $error ? 'true' : null,
        'aria-describedby' => $describedBy !== '' ? $describedBy : null,
        'class' => input_classes('min-h-24 resize-y py-2.5'),
    ];
    return '<div class="' . e(cn('flex flex-col gap-1.5', $o['class'] ?? '')) . '">'
        . field_label($id, $label, !empty($o['optional']))
        . (!empty($o['hint']) ? '<p id="' . e($id) . '-hint" class="-mt-0.5 text-mic text-discret">' . e($o['hint']) . '</p>' : '')
        . '<textarea' . html_attrs($attrs) . '>' . e($o['value'] ?? '') . '</textarea>'
        . field_error("{$id}-error", $error)
        . '</div>';
}

/** @param array<string,string> $options value → label */
function select_field(string $name, string $label, array $options, array $o = []): string
{
    $id = $o['id'] ?? "field-{$name}";
    $error = $o['error'] ?? null;
    $value = (string) ($o['value'] ?? '');
    $html = '';
    foreach ($options as $v => $l) {
        $html .= '<option value="' . e($v) . '"' . ((string) $v === $value ? ' selected' : '') . '>' . e($l) . '</option>';
    }
    $describedBy = trim((!empty($o['hint']) ? "{$id}-hint " : '') . ($error ? "{$id}-error" : ''));
    return '<div class="' . e(cn('flex flex-col gap-1.5', $o['class'] ?? '')) . '">'
        . field_label($id, $label, !empty($o['optional']))
        . (!empty($o['hint']) ? '<p id="' . e($id) . '-hint" class="-mt-0.5 text-mic text-discret">' . e($o['hint']) . '</p>' : '')
        . '<span class="relative block"><select' . html_attrs([
            'id' => $id,
            'name' => $name,
            'required' => !empty($o['required']),
            'aria-invalid' => $error ? 'true' : null,
            'aria-describedby' => $describedBy !== '' ? $describedBy : null,
            'class' => input_classes('h-control cursor-pointer appearance-none pr-11'),
        ]) . '>' . $html . '</select>'
        . icon('chevron-down', 20, 'pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-discret') . '</span>'
        . field_error("{$id}-error", $error)
        . '</div>';
}

/** @param array<string,string|array{label:string,description?:string}> $options */
function radio_group(string $name, string $legend, array $options, array $o = []): string
{
    $id = $o['id'] ?? "field-{$name}";
    $error = $o['error'] ?? null;
    $value = (string) ($o['value'] ?? '');
    $items = '';
    foreach ($options as $v => $opt) {
        $label = is_array($opt) ? $opt['label'] : $opt;
        $desc = is_array($opt) ? ($opt['description'] ?? null) : null;
        $rid = "{$id}-{$v}";
        $items .= '<label for="' . e($rid) . '" class="group flex min-h-control-s cursor-pointer items-start gap-3 py-1.5">'
            . '<span class="relative mt-[0.12em] inline-flex shrink-0 text-corp"><input type="radio" id="' . e($rid) . '" name="' . e($name) . '" value="' . e($v) . '"'
            . ((string) $v === $value ? ' checked' : '') . (!empty($o['required']) ? ' required' : '')
            . ' class="size-[1.3em] cursor-pointer appearance-none rounded-full border-[1.5px] border-linie-control bg-suprafata transition-[border-color,box-shadow] duration-100 ease-filet hover:border-cerneala checked:border-actiune checked:bg-actiune checked:shadow-[inset_0_0_0_0.22em_var(--da-suprafata)] group-data-[invalid]/radios:border-2 group-data-[invalid]/radios:border-carmin disabled:cursor-not-allowed disabled:bg-adancit"></span>'
            . '<span class="flex flex-col gap-0.5"><span class="text-corp text-cerneala group-has-[:disabled]:text-discret">' . e($label) . '</span>'
            . ($desc ? '<span class="text-mic text-discret">' . e($desc) . '</span>' : '') . '</span></label>';
    }
    return '<fieldset id="' . e($id) . '" tabindex="-1"' . ($error ? ' data-invalid aria-describedby="' . e($id) . '-error"' : '') . ' class="' . e(cn('group/radios flex min-w-0 flex-col gap-1.5', $o['class'] ?? '')) . '">'
        . '<legend class="mb-1.5 text-control font-medium text-cerneala">' . e($legend) . (!empty($o['optional']) ? '<span class="font-normal text-discret"> (opțional)</span>' : '') . '</legend>'
        . (!empty($o['hint']) ? '<p class="-mt-1 mb-1 text-mic text-discret">' . e($o['hint']) . '</p>' : '')
        . '<div class="' . (!empty($o['inline']) ? 'flex flex-row flex-wrap gap-x-6' : 'flex flex-col') . '">' . $items . '</div>'
        . field_error("{$id}-error", $error)
        . '</fieldset>';
}

/** A checkbox with its label (ConsentCheckbox / Checkbox). $labelHtml is trusted HTML. */
function checkbox_field(string $name, string $labelHtml, array $o = []): string
{
    $id = $o['id'] ?? "field-{$name}";
    $error = $o['error'] ?? null;
    return '<div class="' . e(cn('flex flex-col gap-1', $o['class'] ?? '')) . '"><label for="' . e($id) . '" class="group flex min-h-control-s cursor-pointer items-start gap-3 py-1.5">'
        . '<span class="relative mt-[0.12em] inline-flex shrink-0 text-corp"><input type="checkbox"' . html_attrs([
            'id' => $id,
            'name' => $name,
            'value' => $o['value'] ?? '1',
            'checked' => !empty($o['checked']),
            'required' => !empty($o['required']),
            'aria-invalid' => $error ? 'true' : null,
            'aria-describedby' => $error ? "{$id}-error" : null,
            'class' => 'peer size-[1.3em] cursor-pointer appearance-none rounded-bloc border-[1.5px] border-linie-control bg-suprafata transition-colors duration-100 ease-filet hover:border-cerneala checked:border-actiune checked:bg-actiune aria-[invalid=true]:border-2 aria-[invalid=true]:border-carmin disabled:cursor-not-allowed disabled:border-linie-control disabled:bg-adancit',
        ]) . '>'
        . '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="shrink-0 pointer-events-none absolute inset-0 m-auto size-[0.95em] text-pe-actiune opacity-0 peer-checked:opacity-100"><path d="M20 6 9 17l-5-5"></path></svg></span>'
        . '<span class="flex flex-col gap-0.5"><span class="text-corp text-cerneala group-has-[:disabled]:text-discret">' . $labelHtml
        . (!empty($o['required']) ? '<span class="text-discret"> (obligatoriu)</span>' : '') . '</span>'
        . (!empty($o['description']) ? '<span class="text-mic text-discret">' . e($o['description']) . '</span>' : '') . '</span></label>'
        . field_error("{$id}-error", $error) . '</div>';
}

/**
 * The list of what to fix, linking to each field (ErrorSummary).
 *
 * @param array<string,string> $errors field name → message ('form' = a message without a field)
 */
function error_summary(array $errors, string $title = 'Corectați datele de mai jos'): string
{
    if ($errors === []) {
        return '';
    }
    $items = '';
    $general = '';
    foreach ($errors as $name => $msg) {
        if ($name === 'form') {
            $general = '<p class="mt-2 text-corp">' . e($msg) . '</p>';
            continue;
        }
        $items .= '<li><a href="#field-' . e($name) . '" class="text-corp font-medium text-carmin underline underline-offset-4 hover:decoration-2">' . e($msg) . '</a></li>';
    }
    return '<div tabindex="-1" role="alert" data-autofocus aria-labelledby="erori-titlu" class="rounded-panou border-2 border-carmin bg-carmin-pal p-4 text-cerneala sm:p-5">'
        . '<h2 id="erori-titlu" class="flex items-center gap-2 text-h3 font-semibold">' . icon('alert-triangle', 22, 'text-carmin') . e($title) . '</h2>'
        . $general . ($items !== '' ? '<ul class="mt-2 flex flex-col gap-1">' . $items . '</ul>' : '') . '</div>';
}

/** The green „sent” panel after a form. */
function success_panel(string $message, string $after = ''): string
{
    return '<div class="rounded-panou bg-menta-pal p-6"><p tabindex="-1" role="status" data-autofocus class="flex items-start gap-3 text-h3 font-semibold text-cerneala outline-none">'
        . icon('check', 24, 'mt-0.5 shrink-0') . e($message) . '</p>'
        . ($after !== '' ? '<p class="mt-3 text-corp text-cerneala">' . e($after) . '</p>' : '') . '</div>';
}

function submit_button(string $label, string $size = 'l', string $class = ''): string
{
    return '<button type="submit" data-pending="Se trimite" class="' . e(btn('primary', $size, $class)) . '">' . e($label) . '</button>';
}
