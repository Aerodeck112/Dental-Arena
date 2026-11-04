import type {
  AppointmentSource,
  AppointmentStatus,
  CancelledBy,
  Comfort,
  ConfirmationChannel,
  ConsentMethod,
  ConsentType,
  DataRequestStatus,
  DataRequestType,
  Density,
  DocumentKind,
  EInvoiceStatus,
  InvoiceStatus,
  LeadActivityType,
  LeadSource,
  LeadStatus,
  MessageChannel,
  MessageKind,
  MessageStatus,
  PaymentMethod,
  PlanItemStatus,
  PlanStatus,
  PriceUnit,
  RecallStatus,
  Role,
  Sex,
  ThemePreference,
  TimeOffKind,
  ToothConditionType,
} from "@/generated/prisma/enums";

/**
 * Every enum → its Romanian label (docs/architecture.md §0.3). The only place where enum
 * labels live. Pure and client-safe.
 */

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  MEDIC: "Medic",
  RECEPTIE: "Recepție",
};

export const THEME_LABEL: Record<ThemePreference, string> = {
  SISTEM: "Sistem",
  LUMINOS: "Luminos",
  INTUNECAT: "Întunecat",
};

export const DENSITY_LABEL: Record<Density, string> = {
  COMPACT: "Compact",
  CONFORTABIL: "Confortabil",
};

/** Design system §12.3: Programat, Confirmat, Sosit, Finalizat, Anulat, Neprezentat, plus „În tratament” (§0.2). */
export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  PROGRAMAT: "Programat",
  CONFIRMAT: "Confirmat",
  SOSIT: "Sosit",
  IN_TRATAMENT: "În tratament",
  FINALIZAT: "Finalizat",
  ANULAT: "Anulat",
  NEPREZENTAT: "Neprezentat",
};

/** The action that leads to each status (design system §12.3). */
export const APPOINTMENT_STATUS_ACTION: Record<AppointmentStatus, string> = {
  PROGRAMAT: "Readuceți la Programat",
  CONFIRMAT: "Confirmați programarea",
  SOSIT: "A sosit",
  IN_TRATAMENT: "Începeți tratamentul",
  FINALIZAT: "Finalizați",
  ANULAT: "Anulați programarea",
  NEPREZENTAT: "Marcați ca neprezentat",
};

export const APPOINTMENT_SOURCE_LABEL: Record<AppointmentSource, string> = {
  ONLINE: "Online",
  TELEFON: "Telefon",
  RECEPTIE: "Recepție",
  RECHEMARE: "Rechemare",
};

export const CONFIRMATION_CHANNEL_LABEL: Record<ConfirmationChannel, string> = {
  TELEFON: "Telefon",
  SMS: "SMS",
  EMAIL: "E-mail",
  LINK: "Link din mesaj",
  RECEPTIE: "La recepție",
};

export const CANCELLED_BY_LABEL: Record<CancelledBy, string> = {
  PACIENT: "Pacientul",
  CLINICA: "Clinica",
};

/** The patient's own words from the comfort question (design system §12.1). */
export const COMFORT_LABEL: Record<Comfort, string> = {
  FARA_EMOTII: "N-am emoții",
  EMOTII: "Am puține emoții",
  FRICA: "Mi-e frică",
};

/** Short tags for the CRM overlays (design system §3.4). */
export const COMFORT_TAG: Record<Comfort, string> = {
  FARA_EMOTII: "Fără emoții",
  EMOTII: "Emoții",
  FRICA: "Mi-e frică",
};

export const SEX_LABEL: Record<Sex, string> = {
  F: "Feminin",
  M: "Masculin",
};

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  FORMULAR_CONTACT: "Formular de contact",
  PROGRAMARE_ONLINE: "Programare online",
  APEL_INVERS: "Cerere de apel",
  TELEFON: "Telefon",
  RECOMANDARE: "Recomandare",
  SOCIAL: "Rețele sociale",
  ALT: "Altă sursă",
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NOU: "Nou",
  CONTACTAT: "Contactat",
  PROGRAMAT: "Programat",
  PIERDUT: "Pierdut",
};

export const LEAD_ACTIVITY_TYPE_LABEL: Record<LeadActivityType, string> = {
  NOTA: "Notă",
  APEL: "Apel",
  SMS: "SMS",
  EMAIL: "E-mail",
  STATUS: "Schimbare de status",
  ATRIBUIRE: "Atribuire",
  CONVERSIE: "Conversie în pacient",
};

export const CONSENT_TYPE_LABEL: Record<ConsentType, string> = {
  GDPR_DATE_SANATATE: "Prelucrarea datelor de sănătate (GDPR)",
  TRATAMENT: "Consimțământ pentru tratament",
  INHALOSEDARE: "Consimțământ pentru inhalosedare",
  SMS: "Mesaje SMS",
  EMAIL: "Mesaje e-mail",
  MARKETING: "Comunicări de marketing",
  FOTO: "Fotografii clinice",
};

export const CONSENT_METHOD_LABEL: Record<ConsentMethod, string> = {
  FORMULAR_ONLINE: "Formular online",
  SEMNAT_HARTIE: "Semnat pe hârtie",
  SEMNAT_TABLETA: "Semnat pe tabletă",
  VERBAL: "Verbal",
};

export const TOOTH_CONDITION_LABEL: Record<ToothConditionType, string> = {
  CARIE: "Carie",
  OBTURATIE: "Obturație",
  ENDODONTIE: "Endodonție",
  COROANA: "Coroană",
  PUNTE: "Punte",
  IMPLANT: "Implant",
  EXTRAS: "Extras",
  LIPSA: "Lipsă",
  FRACTURA: "Fractură",
  RADACINA_RESTANTA: "Rădăcină restantă",
  FATETA: "Fațetă",
  SIGILARE: "Sigilare",
  MOBILITATE: "Mobilitate",
  PARODONTOPATIE: "Parodontopatie",
  PROTEZA: "Proteză",
  INCLUS: "Dinte inclus",
  ALTA: "Altă constatare",
};

/** Odontogram letters (design system §6.8: C, O, E, Cr, X, I; the rest are unique and short). */
export const TOOTH_CONDITION_LETTER: Record<ToothConditionType, string> = {
  CARIE: "C",
  OBTURATIE: "O",
  ENDODONTIE: "E",
  COROANA: "Cr",
  PUNTE: "Pt",
  IMPLANT: "I",
  EXTRAS: "X",
  LIPSA: "L",
  FRACTURA: "F",
  RADACINA_RESTANTA: "R",
  FATETA: "Ft",
  SIGILARE: "S",
  MOBILITATE: "M",
  PARODONTOPATIE: "Pd",
  PROTEZA: "Pr",
  INCLUS: "In",
  ALTA: "A",
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  CIORNA: "Ciornă",
  PREZENTAT: "Prezentat",
  ACCEPTAT: "Acceptat",
  IN_CURS: "În curs",
  FINALIZAT: "Finalizat",
  RESPINS: "Respins",
  ANULAT: "Anulat",
};

export const PLAN_ITEM_STATUS_LABEL: Record<PlanItemStatus, string> = {
  PROPUS: "Propus",
  ACCEPTAT: "Acceptat",
  PROGRAMAT: "Programat",
  EFECTUAT: "Efectuat",
  ANULAT: "Anulat",
};

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  RADIOGRAFIE_PANORAMICA: "Radiografie panoramică",
  RADIOGRAFIE_RETROALVEOLARA: "Radiografie retroalveolară",
  CBCT: "CBCT",
  FOTOGRAFIE: "Fotografie",
  CONSIMTAMANT: "Consimțământ semnat",
  DEVIZ: "Deviz",
  SCRISOARE_MEDICALA: "Scrisoare medicală",
  ALT: "Alt document",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  EMISA: "Emisă",
  ANULATA: "Anulată",
};

export const EINVOICE_STATUS_LABEL: Record<EInvoiceStatus, string> = {
  NETRANSMISA: "Netransmisă",
  IN_ASTEPTARE: "În așteptare",
  TRANSMISA: "Transmisă",
  RESPINSA: "Respinsă",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  NUMERAR: "Numerar",
  CARD: "Card",
  TRANSFER: "Transfer bancar",
};

export const PRICE_UNIT_LABEL: Record<PriceUnit, string> = {
  ACT: "act",
  DINTE: "dinte",
  ARCADA: "arcadă",
  ORA: "oră",
  SEDINTA: "ședință",
};

export const TIME_OFF_KIND_LABEL: Record<TimeOffKind, string> = {
  CONCEDIU: "Concediu",
  FORMARE: "Formare profesională",
  BLOCAJ: "Interval blocat",
  SARBATOARE: "Sărbătoare legală",
};

export const RECALL_STATUS_LABEL: Record<RecallStatus, string> = {
  DE_FACUT: "De făcut",
  CONTACTAT: "Contactat",
  PROGRAMAT: "Programat",
  REFUZAT: "Refuzat",
  ANULAT: "Anulat",
};

export const MESSAGE_CHANNEL_LABEL: Record<MessageChannel, string> = {
  EMAIL: "E-mail",
  SMS: "SMS",
};

export const MESSAGE_KIND_LABEL: Record<MessageKind, string> = {
  CONFIRMARE_PROGRAMARE: "Confirmarea programării",
  REMINDER: "Reamintire",
  ANULARE: "Anulare",
  MODIFICARE: "Modificare",
  NOTIFICARE_CLINICA: "Notificare pentru clinică",
  RECHEMARE: "Rechemare",
  MANUAL: "Mesaj manual",
};

export const MESSAGE_STATUS_LABEL: Record<MessageStatus, string> = {
  TRIMIS: "Trimis",
  SIMULAT: "Simulat",
  EROARE: "Eroare",
};

export const DATA_REQUEST_TYPE_LABEL: Record<DataRequestType, string> = {
  ACCES: "Acces la date",
  EXPORT: "Export (portabilitate)",
  RECTIFICARE: "Rectificare",
  STERGERE: "Ștergere",
  OPOZITIE: "Opoziție",
};

export const DATA_REQUEST_STATUS_LABEL: Record<DataRequestStatus, string> = {
  PRIMITA: "Primită",
  IN_LUCRU: "În lucru",
  FINALIZATA: "Finalizată",
  RESPINSA: "Respinsă",
};

/** Clinic scope options of the top-bar switch (design system §6.8). */
export const CLINIC_SCOPE_LABEL = {
  cristesti: "Cristești",
  ludus: "Luduș",
  ambele: "Ambele",
} as const;

/** `{ value, label }[]` for a `Select` or `RadioGroup`, in the record's order. */
export function labelOptions<K extends string>(labels: Record<K, string>): { value: K; label: string }[] {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
}
