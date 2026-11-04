"use client";

import { Tabs, type TabItem } from "@/components/ui/Tabs";

/**
 * The tabs of the patient file. The server decides which tabs a role sees (RECEPTIE gets no
 * Anamneză, Odontogramă or clinical notes), this only renders them.
 */
export function PatientTabs({ items }: { items: TabItem[] }) {
  return <Tabs items={items} label="Secțiunile fișei" className="-mx-1 overflow-x-auto px-1" />;
}
