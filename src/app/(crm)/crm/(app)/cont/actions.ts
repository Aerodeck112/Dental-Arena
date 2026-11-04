"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crmAction, DomainError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { optionalField, zPhoneRo, zText } from "@/lib/validation/common";

/** „Date personale”: name and phone of the signed-in user. */
export const updateProfile = crmAction(
  {
    permission: "dashboard.view",
    schema: z.object({
      firstName: zText(80),
      lastName: zText(80),
      phone: optionalField(zPhoneRo),
    }),
    successMessage: "Datele au fost salvate.",
  },
  async ({ firstName, lastName, phone }, { user }) => {
    await prisma.user.update({
      where: { id: user.id },
      data: { firstName, lastName, phone: phone ?? null },
    });
    await audit(
      { action: "user.update", entityType: "User", entityId: user.id, metadata: { fields: ["firstName", "lastName", "phone"] } },
      { actor: user },
    );
    revalidatePath("/crm", "layout");
    return null;
  },
);

/**
 * „Schimbați parola”: checks the current password and the policy, then revokes every other
 * session (`sessionVersion++`) and signs this device in again.
 */
export const changePassword = crmAction(
  {
    permission: "dashboard.view",
    schema: z
      .object({
        currentPassword: z.string({ error: "Introduceți parola actuală." }).min(1, { error: "Introduceți parola actuală." }).max(200),
        newPassword: z.string({ error: "Introduceți parola nouă." }).min(1, { error: "Introduceți parola nouă." }).max(200),
        confirmPassword: z.string({ error: "Repetați parola nouă." }).min(1, { error: "Repetați parola nouă." }).max(200),
      })
      .refine((v) => v.newPassword === v.confirmPassword, {
        path: ["confirmPassword"],
        error: "Parolele nu coincid. Scrieți aceeași parolă de două ori.",
      }),
    successMessage: "Parola a fost schimbată. Celelalte sesiuni au fost închise.",
  },
  async ({ currentPassword, newPassword }, { user }) => {
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true, mustChangePassword: true },
    });
    if (!row) throw new DomainError("UNAUTHENTICATED");
    if (!(await verifyPassword(currentPassword, row.passwordHash))) {
      throw new DomainError("VALIDATION", "Parola actuală nu este corectă.", {
        fieldErrors: { currentPassword: ["Parola actuală nu este corectă."] },
      });
    }
    const problems = passwordProblems(newPassword, user.email);
    if (newPassword === currentPassword) problems.push("Parola nouă trebuie să fie diferită de cea actuală.");
    if (problems.length > 0) {
      throw new DomainError("VALIDATION", problems[0], { fieldErrors: { newPassword: problems } });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
        failedLogins: 0,
      },
      select: { sessionVersion: true, role: true },
    });
    await createSession({ id: user.id, role: updated.role, sessionVersion: updated.sessionVersion });
    await audit(
      { action: "user.update", entityType: "User", entityId: user.id, metadata: { fields: ["password"] } },
      { actor: user },
    );
    if (row.mustChangePassword) redirect("/crm");
    return null;
  },
);

/** „Aspect”: theme (Sistem, Luminos, Întunecat) and density (Compact, Confortabil). */
export const updateAppearance = crmAction(
  {
    permission: "dashboard.view",
    schema: z.object({
      theme: z.enum(["SISTEM", "LUMINOS", "INTUNECAT"], { error: "Alegeți o temă." }),
      density: z.enum(["COMPACT", "CONFORTABIL"], { error: "Alegeți o densitate." }),
    }),
    successMessage: "Aspectul a fost salvat.",
  },
  async ({ theme, density }, { user }) => {
    await prisma.user.update({ where: { id: user.id }, data: { theme, density } });
    revalidatePath("/crm", "layout");
    return { theme, density };
  },
);
