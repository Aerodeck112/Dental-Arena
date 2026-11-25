/**
 * Dental Arena UI kit (docs/design-system.md §10). Role tokens only; every component shrinks under
 * data-density="compact". Client components are marked "use client" in their own files, so this
 * barrel is safe to import from Server Components.
 */
export { Accordion, type AccordionItem } from "./Accordion";
export { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";
export { Button, type ButtonProps } from "./Button";
export { ButtonLink, type ButtonLinkProps } from "./ButtonLink";
export { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-styles";
export { Checkbox, CheckboxBox, type CheckboxProps } from "./Checkbox";
export { ChoiceButton, type ChoiceButtonProps, type ChoiceTone } from "./ChoiceButton";
export { ChoicePanel, type ChoicePanelProps } from "./ChoicePanel";
export { ConsentCheckbox, type ConsentCheckboxProps } from "./ConsentCheckbox";
export { CountBadge } from "./CountBadge";
export { DataTable, type DataTableColumn, type DataTableProps } from "./DataTable";
export { DateInput } from "./DateInput";
export { Dialog, type DialogProps } from "./Dialog";
export { Drawer, type DrawerProps } from "./Drawer";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ErrorSummary, type ErrorSummaryProps } from "./ErrorSummary";
export { Field, FieldError, type FieldProps } from "./Field";
export { fieldId, fieldIds } from "./field-ids";
export { inputClasses } from "./field-styles";
export { ComfortDot, FlagTag, type FlagKind } from "./FlagTag";
export { Icon, ICON_NAMES, type IconName } from "./Icon";
export { Menu, type MenuItem, type MenuProps } from "./Menu";
export { PageHeader, type PageHeaderProps } from "./PageHeader";
export { Pagination, pageHref, type PaginationProps } from "./Pagination";
export { Panel, type PanelProps, type PanelTone } from "./Panel";
export { PhoneField } from "./PhoneField";
export { Popover, type PopoverProps } from "./Popover";
export { RadioGroup, type RadioGroupProps, type RadioOption } from "./RadioGroup";
export { SearchField } from "./SearchField";
export { SegmentedControl, type SegmentedControlProps, type SegmentOption } from "./SegmentedControl";
export { Select, type SelectOption, type SelectProps } from "./Select";
export { SlotButton, type SlotButtonProps } from "./SlotButton";
export { Spinner } from "./Spinner";
export { STATUS_BLOCK, STATUS_ICON, StatusChip, type StatusChipProps } from "./StatusChip";
export { SubmitButton, type SubmitButtonProps } from "./SubmitButton";
export { activeTabHref, Tabs, type TabItem } from "./Tabs";
export { TextArea, type TextAreaProps } from "./TextArea";
export { TextField, type TextFieldProps } from "./TextField";
export { TextLink, type TextLinkProps } from "./TextLink";
export { applyTheme, THEME_STORAGE_KEY, ThemeSync, type ThemeChoice } from "./ThemeSync";
export { TimeInput } from "./TimeInput";
export { dismissToast, showToast, Toaster, TOAST_DURATION_MS, useToast, type ToastInput, type ToastKind } from "./Toast";
export { VisuallyHidden } from "./VisuallyHidden";
export { WeekStrip, type WeekStripDay, type WeekStripProps } from "./WeekStrip";
