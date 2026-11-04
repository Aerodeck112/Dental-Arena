-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "county" TEXT NOT NULL DEFAULT 'Mureș',
    "postalCode" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "mapsUrl" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "publishHours" BOOLEAN NOT NULL DEFAULT false,
    "sedationUnits" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LocationHours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "openMinute" INTEGER NOT NULL,
    "closeMinute" INTEGER NOT NULL,
    CONSTRAINT "LocationHours_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cabinet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Cabinet_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastLoginAt" DATETIME,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "theme" TEXT NOT NULL DEFAULT 'SISTEM',
    "density" TEXT NOT NULL DEFAULT 'COMPACT',
    "homeLocationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_homeLocationId_fkey" FOREIGN KEY ("homeLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "slug" TEXT NOT NULL,
    "honorific" TEXT NOT NULL DEFAULT 'Dr.',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "publicName" TEXT NOT NULL,
    "roleLine" TEXT NOT NULL,
    "bio" TEXT,
    "photoPath" TEXT,
    "monogram" TEXT,
    "publicVisible" BOOLEAN NOT NULL DEFAULT true,
    "acceptsOnlineBooking" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DoctorCategory" (
    "doctorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "showOnSite" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("doctorId", "categoryId"),
    CONSTRAINT "DoctorCategory_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DoctorCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "cabinetId" TEXT,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "onlineBooking" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" DATETIME,
    "validUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkShift_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkShift_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkShift_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "Cabinet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShiftBreak" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "label" TEXT,
    CONSTRAINT "ShiftBreak_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "WorkShift" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeOff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT,
    "locationId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'CONCEDIU',
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeOff_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimeOff_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publicVisible" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "priceMin" INTEGER,
    "priceMax" INTEGER,
    "priceFrom" BOOLEAN NOT NULL DEFAULT false,
    "unit" TEXT NOT NULL DEFAULT 'ACT',
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "bookableOnline" BOOLEAN NOT NULL DEFAULT false,
    "onlineLabel" TEXT,
    "onlineHint" TEXT,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "isRepresentative" BOOLEAN NOT NULL DEFAULT false,
    "toothSpecific" BOOLEAN NOT NULL DEFAULT false,
    "recallMonths" INTEGER,
    "publicVisible" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileNumber" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "cnpEncrypted" TEXT,
    "cnpHash" TEXT,
    "birthDate" DATETIME,
    "sex" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "street" TEXT,
    "city" TEXT,
    "county" TEXT,
    "guardianId" TEXT,
    "preferredLocationId" TEXT,
    "primaryDoctorId" TEXT,
    "comfortDefault" TEXT,
    "prefersSedation" BOOLEAN NOT NULL DEFAULT false,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "emailOptIn" BOOLEAN NOT NULL DEFAULT false,
    "acquisitionSource" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "anonymizedAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Patient_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Patient_preferredLocationId_fkey" FOREIGN KEY ("preferredLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Patient_primaryDoctorId_fkey" FOREIGN KEY ("primaryDoctorId") REFERENCES "Doctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicalHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "allergies" TEXT,
    "medications" TEXT,
    "anticoagulants" BOOLEAN NOT NULL DEFAULT false,
    "cardiacDisease" BOOLEAN NOT NULL DEFAULT false,
    "hypertension" BOOLEAN NOT NULL DEFAULT false,
    "diabetes" BOOLEAN NOT NULL DEFAULT false,
    "asthma" BOOLEAN NOT NULL DEFAULT false,
    "epilepsy" BOOLEAN NOT NULL DEFAULT false,
    "hepatitis" BOOLEAN NOT NULL DEFAULT false,
    "hiv" BOOLEAN NOT NULL DEFAULT false,
    "bleedingDisorder" BOOLEAN NOT NULL DEFAULT false,
    "bisphosphonates" BOOLEAN NOT NULL DEFAULT false,
    "pregnancy" BOOLEAN NOT NULL DEFAULT false,
    "smoker" BOOLEAN NOT NULL DEFAULT false,
    "otherConditions" TEXT,
    "lastReviewedAt" DATETIME,
    "lastReviewedByUserId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MedicalHistory_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "method" TEXT NOT NULL,
    "textVersion" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "treatmentPlanId" TEXT,
    "documentId" TEXT,
    "ipHash" TEXT,
    "recordedById" TEXT,
    "notes" TEXT,
    CONSTRAINT "Consent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Consent_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Consent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PatientDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ToothCondition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "tooth" INTEGER NOT NULL,
    "surfaces" TEXT,
    "condition" TEXT NOT NULL,
    "notes" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "resolvedAt" DATETIME,
    CONSTRAINT "ToothCondition_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TreatmentPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CIORNA',
    "notes" TEXT,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "presentedAt" DATETIME,
    "acceptedAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TreatmentPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TreatmentPlan_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TreatmentPlanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "serviceId" TEXT,
    "tooth" INTEGER,
    "surfaces" TEXT,
    "description" TEXT NOT NULL,
    "phase" INTEGER NOT NULL DEFAULT 1,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PROPUS',
    "appointmentId" TEXT,
    "performedAt" DATETIME,
    "performedByDoctorId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TreatmentPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TreatmentPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TreatmentPlanItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TreatmentPlanItem_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TreatmentPlanItem_performedByDoctorId_fkey" FOREIGN KEY ("performedByDoctorId") REFERENCES "Doctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatientDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "tooth" INTEGER,
    "takenAt" DATETIME,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "PatientDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT
);

-- CreateTable
CREATE TABLE "PatientTag" (
    "patientId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("patientId", "tagId"),
    CONSTRAINT "PatientTag_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatientNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "clinical" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientNote_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PatientNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "cabinetId" TEXT,
    "patientId" TEXT,
    "leadId" TEXT,
    "serviceId" TEXT,
    "reason" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROGRAMAT',
    "source" TEXT NOT NULL,
    "comfort" TEXT,
    "comfortNote" TEXT,
    "wantsSedation" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "confirmedAt" DATETIME,
    "confirmedVia" TEXT,
    "arrivedAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    "noShowAt" DATETIME,
    "reminderSentAt" DATETIME,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "Cabinet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOU',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "message" TEXT,
    "locationId" TEXT,
    "serviceId" TEXT,
    "preferredDoctorId" TEXT,
    "preferredTime" TEXT,
    "comfort" TEXT,
    "comfortNote" TEXT,
    "wantsSedation" BOOLEAN NOT NULL DEFAULT false,
    "forChild" BOOLEAN NOT NULL DEFAULT false,
    "childFirstName" TEXT,
    "childAge" INTEGER,
    "consentGdprAt" DATETIME,
    "consentTextVersion" TEXT,
    "consentSms" BOOLEAN NOT NULL DEFAULT false,
    "sourcePath" TEXT,
    "ipHash" TEXT,
    "idempotencyKey" TEXT,
    "assignedToId" TEXT,
    "patientId" TEXT,
    "lostReason" TEXT,
    "contactedAt" DATETIME,
    "convertedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_preferredDoctorId_fkey" FOREIGN KEY ("preferredDoctorId") REFERENCES "Doctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeadActivity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "locationId" TEXT,
    "doctorId" TEXT,
    "reason" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DE_FACUT',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "outcomeNote" TEXT,
    "sourceAppointmentId" TEXT,
    "bookedAppointmentId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recall_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recall_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recall_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "series" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "patientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EMISA',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATETIME,
    "currency" TEXT NOT NULL DEFAULT 'RON',
    "subtotal" INTEGER NOT NULL,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "vatTotal" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "buyerName" TEXT NOT NULL,
    "buyerAddress" TEXT,
    "buyerEmail" TEXT,
    "buyerCompany" TEXT,
    "buyerCui" TEXT,
    "buyerRegCom" TEXT,
    "notes" TEXT,
    "eInvoiceStatus" TEXT NOT NULL DEFAULT 'NETRANSMISA',
    "eInvoiceRef" TEXT,
    "eInvoiceError" TEXT,
    "createdById" TEXT,
    "cancelledAt" DATETIME,
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "serviceId" TEXT,
    "treatmentPlanItemId" TEXT,
    "doctorId" TEXT,
    "description" TEXT NOT NULL,
    "tooth" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "vatRate" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_treatmentPlanItemId_fkey" FOREIGN KEY ("treatmentPlanItemId") REFERENCES "TreatmentPlanItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "locationId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptSeries" TEXT,
    "receiptNumber" INTEGER,
    "reference" TEXT,
    "notes" TEXT,
    "receivedById" TEXT,
    "cancelledAt" DATETIME,
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "error" TEXT,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "leadId" TEXT,
    "sentById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "patientId" TEXT,
    "ipHash" TEXT,
    "metadata" TEXT
);

-- CreateTable
CREATE TABLE "DataRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRIMITA',
    "requesterName" TEXT NOT NULL,
    "contact" TEXT,
    "details" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "handledById" TEXT,
    "outcome" TEXT,
    CONSTRAINT "DataRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NumberSequence" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "resetAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LocationHours_locationId_weekday_openMinute_key" ON "LocationHours"("locationId", "weekday", "openMinute");

-- CreateIndex
CREATE UNIQUE INDEX "Cabinet_locationId_name_key" ON "Cabinet"("locationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_slug_key" ON "Doctor"("slug");

-- CreateIndex
CREATE INDEX "WorkShift_doctorId_weekday_idx" ON "WorkShift"("doctorId", "weekday");

-- CreateIndex
CREATE INDEX "WorkShift_locationId_weekday_idx" ON "WorkShift"("locationId", "weekday");

-- CreateIndex
CREATE INDEX "TimeOff_doctorId_startsAt_idx" ON "TimeOff"("doctorId", "startsAt");

-- CreateIndex
CREATE INDEX "TimeOff_locationId_startsAt_idx" ON "TimeOff"("locationId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Service_code_key" ON "Service"("code");

-- CreateIndex
CREATE INDEX "Service_categoryId_sortOrder_idx" ON "Service"("categoryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_fileNumber_key" ON "Patient"("fileNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_cnpHash_key" ON "Patient"("cnpHash");

-- CreateIndex
CREATE INDEX "Patient_lastName_firstName_idx" ON "Patient"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");

-- CreateIndex
CREATE INDEX "Patient_searchText_idx" ON "Patient"("searchText");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalHistory_patientId_key" ON "MedicalHistory"("patientId");

-- CreateIndex
CREATE INDEX "Consent_patientId_type_idx" ON "Consent"("patientId", "type");

-- CreateIndex
CREATE INDEX "ToothCondition_patientId_tooth_idx" ON "ToothCondition"("patientId", "tooth");

-- CreateIndex
CREATE INDEX "TreatmentPlan_patientId_status_idx" ON "TreatmentPlan"("patientId", "status");

-- CreateIndex
CREATE INDEX "TreatmentPlanItem_planId_phase_idx" ON "TreatmentPlanItem"("planId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "PatientDocument_storageKey_key" ON "PatientDocument"("storageKey");

-- CreateIndex
CREATE INDEX "PatientDocument_patientId_kind_idx" ON "PatientDocument"("patientId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "PatientNote_patientId_createdAt_idx" ON "PatientNote"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "Appointment_locationId_startsAt_idx" ON "Appointment"("locationId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_startsAt_idx" ON "Appointment"("doctorId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_cabinetId_startsAt_idx" ON "Appointment"("cabinetId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_patientId_startsAt_idx" ON "Appointment"("patientId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_status_startsAt_idx" ON "Appointment"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_leadId_idx" ON "Appointment"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_idempotencyKey_key" ON "Lead"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Recall_status_dueDate_idx" ON "Recall"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_patientId_issuedAt_idx" ON "Invoice"("patientId", "issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_locationId_issuedAt_idx" ON "Invoice"("locationId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_series_number_key" ON "Invoice"("series", "number");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_treatmentPlanItemId_idx" ON "InvoiceItem"("treatmentPlanItemId");

-- CreateIndex
CREATE INDEX "Payment_patientId_paidAt_idx" ON "Payment"("patientId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_locationId_paidAt_idx" ON "Payment"("locationId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptSeries_receiptNumber_key" ON "Payment"("receiptSeries", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_key_key" ON "MessageTemplate"("key");

-- CreateIndex
CREATE INDEX "MessageLog_appointmentId_idx" ON "MessageLog"("appointmentId");

-- CreateIndex
CREATE INDEX "MessageLog_patientId_createdAt_idx" ON "MessageLog"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_createdAt_idx" ON "MessageLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_patientId_at_idx" ON "AuditLog"("patientId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_at_idx" ON "AuditLog"("actorId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "DataRequest_status_dueAt_idx" ON "DataRequest"("status", "dueAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
