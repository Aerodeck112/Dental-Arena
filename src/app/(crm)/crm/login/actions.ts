"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { DomainError, publicAction } from "@/lib/actions";
import { audit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/auth/next-path";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { zEmail } from "@/lib/validation/common";

const GENERIC_FAILURE = "E-mailul sau parola nu sunt corecte.";
const MAX_FAILURES = 10;
const LOCK_MINUTES = 15;

const loginSchema = z.object({
  email: zEmail,
  password: z.string({ error: "Introduceți parola." }).min(1, { error: "Introduceți parola." }).max(200),
  next: z.string().max(1000).optional(),
});

/**
 * „Intrați în cont” (docs/architecture.md §5.1): rate limits per IP (20 / 15 min) and per e-mail
 * (5 / 15 min), constant-time password check even for unknown e-mails, lockout after 10
 * failures, one generic failure message, then a redirect to `next` (same-origin /crm only).
 */
export const login = publicAction(
  {
    schema: loginSchema,
    rateLimit: [
      { bucket: "login:ip", limit: 20, windowSec: 15 * 60 },
      { bucket: "login:email", limit: 5, windowSec: 15 * 60, key: (i) => i.email },
    ],
  },
  async ({ email, password, next }) => {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        firstName: true,
        lastName: true,
        active: true,
        failedLogins: true,
        lockedUntil: true,
        sessionVersion: true,
        mustChangePassword: true,
        homeLocationId: true,
        theme: true,
        density: true,
        doctor: { select: { id: true, publicName: true } },
      },
    });

    // Always run bcrypt, so the response time does not reveal which e-mails exist.
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    const now = new Date();
    const locked = Boolean(user?.lockedUntil && user.lockedUntil > now);

    if (!user || !passwordOk || !user.active || locked) {
      let reason = "parola-gresita";
      if (!user) reason = "email-necunoscut";
      else if (locked) reason = "cont-blocat";
      else if (!user.active) reason = "cont-inactiv";

      if (user && !locked && !passwordOk) {
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: { failedLogins: { increment: 1 } },
          select: { failedLogins: true },
        });
        if (updated.failedLogins >= MAX_FAILURES) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) },
          });
          reason = "cont-blocat-acum";
        }
      }
      await audit({ action: "auth.failed", entityType: "User", entityId: user?.id ?? null, metadata: { reason } });
      throw new DomainError("UNAUTHENTICATED", GENERIC_FAILURE);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: now },
    });
    await createSession({ id: user.id, role: user.role, sessionVersion: user.sessionVersion });

    const actor: CurrentUser = {
      id: user.id,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.doctor?.publicName ?? `${user.firstName} ${user.lastName}`.trim(),
      doctorId: user.doctor?.id ?? null,
      homeLocationId: user.homeLocationId,
      theme: user.theme,
      density: user.density,
      mustChangePassword: user.mustChangePassword,
    };
    await audit({ action: "auth.login", entityType: "User", entityId: user.id }, { actor });

    redirect(user.mustChangePassword ? "/crm/cont?schimbare=1" : safeNextPath(next));
  },
);
