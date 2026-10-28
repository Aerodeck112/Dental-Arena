"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crmAction } from "@/lib/actions";
import { zId } from "@/lib/validation/common";
import { cabinetSchema, hoursSchema, locationSchema } from "@/server/locations/schemas";
import { deleteCabinet, saveCabinet, saveLocationHours, updateLocation } from "@/server/locations/service";

/**
 * Locations (docs/architecture.md §4.2 `/crm/locatii`): ADMIN only (`locations.manage`). Address,
 * phone, hours and the publish flag appear on the public site, so saves revalidate it.
 */

function revalidateLocations() {
  revalidatePath("/crm/locatii", "layout");
  revalidatePath("/crm/programari");
  revalidatePath("/", "layout");
}

export const updateLocationAction = crmAction(
  { permission: "locations.manage", schema: locationSchema, successMessage: "Datele clinicii au fost salvate." },
  async (i, { user }) => {
    const r = await updateLocation(i, user);
    revalidateLocations();
    return r;
  },
);

export const saveHoursAction = crmAction(
  { permission: "locations.manage", schema: hoursSchema, successMessage: "Programul clinicii a fost salvat." },
  async ({ locationId, hours }, { user }) => {
    await saveLocationHours(locationId, hours, user);
    revalidateLocations();
    return null;
  },
);

export const saveCabinetAction = crmAction(
  { permission: "locations.manage", schema: cabinetSchema, successMessage: "Cabinetul a fost salvat." },
  async (i, { user }) => {
    const r = await saveCabinet(i, user);
    revalidateLocations();
    return r;
  },
);

export const deleteCabinetAction = crmAction(
  {
    permission: "locations.manage",
    schema: z.object({ id: zId }),
    successMessage: (d: { deleted: boolean }) => (d.deleted ? "Cabinetul a fost șters." : "Cabinetul are programări sau ture, așa că a fost dezactivat."),
  },
  async ({ id }, { user }) => {
    const r = await deleteCabinet(id, user);
    revalidateLocations();
    return r;
  },
);
