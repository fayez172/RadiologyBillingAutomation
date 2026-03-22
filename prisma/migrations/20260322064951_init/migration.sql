-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'BILLING');

-- CreateEnum
CREATE TYPE "MappingConfidence" AS ENUM ('EXACT', 'FUZZY', 'MANUAL', 'UNMAPPED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BILLING',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DbInstance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 1433,
    "username" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "reporting_db" TEXT NOT NULL DEFAULT 'RADSpaRISReportingDB',
    "radiology_db" TEXT NOT NULL DEFAULT 'RADSpaRISRadiologyDB',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DbInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Study" (
    "id" TEXT NOT NULL,
    "composite_key" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "mrn" TEXT,
    "procedure_raw" TEXT,
    "report_dt" TIMESTAMP(3),
    "hospital_name" TEXT,
    "final_rad_name" TEXT,
    "modality" TEXT,
    "image_count" INTEGER,
    "patient_name" TEXT,
    "type" TEXT,
    "type_dr" TEXT,
    "mapping_confidence" "MappingConfidence" NOT NULL DEFAULT 'UNMAPPED',
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicate_group_id" TEXT,
    "upload_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Study_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadJob" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "parsed_rows" INTEGER NOT NULL DEFAULT 0,
    "mapped_rows" INTEGER NOT NULL DEFAULT 0,
    "unmapped_rows" INTEGER NOT NULL DEFAULT 0,
    "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mapping" (
    "id" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "procedure_pattern" TEXT NOT NULL,
    "is_regex" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL,
    "type_dr" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormalizationRule" (
    "id" TEXT NOT NULL,
    "raw_term" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NormalizationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "total_billed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "current_due" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "last_payment_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAlias" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "alias_name" TEXT NOT NULL,
    "instance_id" TEXT,

    CONSTRAINT "ClientAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPrice" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Radiologist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "total_billed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "current_due" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Radiologist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiologistAlias" (
    "id" TEXT NOT NULL,
    "radiologist_id" TEXT NOT NULL,
    "alias_name" TEXT NOT NULL,
    "instance_id" TEXT,

    CONSTRAINT "RadiologistAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiologistPrice" (
    "id" TEXT NOT NULL,
    "radiologist_id" TEXT NOT NULL,
    "type_dr" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadiologistPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalPrice" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "previous_due" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_due" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT NOT NULL,
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "study_id" TEXT,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DbInstance_name_key" ON "DbInstance"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Study_composite_key_key" ON "Study"("composite_key");

-- CreateIndex
CREATE INDEX "Study_instance_id_idx" ON "Study"("instance_id");

-- CreateIndex
CREATE INDEX "Study_hospital_name_idx" ON "Study"("hospital_name");

-- CreateIndex
CREATE INDEX "Study_final_rad_name_idx" ON "Study"("final_rad_name");

-- CreateIndex
CREATE INDEX "Study_modality_idx" ON "Study"("modality");

-- CreateIndex
CREATE INDEX "Study_mapping_confidence_idx" ON "Study"("mapping_confidence");

-- CreateIndex
CREATE INDEX "Study_is_duplicate_idx" ON "Study"("is_duplicate");

-- CreateIndex
CREATE INDEX "Study_report_dt_idx" ON "Study"("report_dt");

-- CreateIndex
CREATE INDEX "Study_composite_key_idx" ON "Study"("composite_key");

-- CreateIndex
CREATE INDEX "UploadJob_instance_id_idx" ON "UploadJob"("instance_id");

-- CreateIndex
CREATE INDEX "Mapping_modality_idx" ON "Mapping"("modality");

-- CreateIndex
CREATE UNIQUE INDEX "Mapping_modality_procedure_pattern_key" ON "Mapping"("modality", "procedure_pattern");

-- CreateIndex
CREATE UNIQUE INDEX "NormalizationRule_raw_term_key" ON "NormalizationRule"("raw_term");

-- CreateIndex
CREATE UNIQUE INDEX "Client_name_key" ON "Client"("name");

-- CreateIndex
CREATE INDEX "ClientAlias_alias_name_idx" ON "ClientAlias"("alias_name");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAlias_alias_name_instance_id_key" ON "ClientAlias"("alias_name", "instance_id");

-- CreateIndex
CREATE INDEX "ClientPrice_client_id_type_idx" ON "ClientPrice"("client_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Radiologist_name_key" ON "Radiologist"("name");

-- CreateIndex
CREATE INDEX "RadiologistAlias_alias_name_idx" ON "RadiologistAlias"("alias_name");

-- CreateIndex
CREATE UNIQUE INDEX "RadiologistAlias_alias_name_instance_id_key" ON "RadiologistAlias"("alias_name", "instance_id");

-- CreateIndex
CREATE INDEX "RadiologistPrice_radiologist_id_type_dr_idx" ON "RadiologistPrice"("radiologist_id", "type_dr");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalPrice_type_key" ON "GlobalPrice"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoice_number_key" ON "Invoice"("invoice_number");

-- CreateIndex
CREATE INDEX "Invoice_client_id_idx" ON "Invoice"("client_id");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_period_start_period_end_idx" ON "Invoice"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoice_id_idx" ON "InvoiceLine"("invoice_id");

-- CreateIndex
CREATE INDEX "Payment_client_id_payment_date_idx" ON "Payment"("client_id", "payment_date");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entity_id_idx" ON "AuditLog"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_idx" ON "AuditLog"("user_id");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- AddForeignKey
ALTER TABLE "Study" ADD CONSTRAINT "Study_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "DbInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Study" ADD CONSTRAINT "Study_upload_job_id_fkey" FOREIGN KEY ("upload_job_id") REFERENCES "UploadJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadJob" ADD CONSTRAINT "UploadJob_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "DbInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAlias" ADD CONSTRAINT "ClientAlias_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAlias" ADD CONSTRAINT "ClientAlias_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "DbInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPrice" ADD CONSTRAINT "ClientPrice_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologistAlias" ADD CONSTRAINT "RadiologistAlias_radiologist_id_fkey" FOREIGN KEY ("radiologist_id") REFERENCES "Radiologist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologistAlias" ADD CONSTRAINT "RadiologistAlias_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "DbInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologistPrice" ADD CONSTRAINT "RadiologistPrice_radiologist_id_fkey" FOREIGN KEY ("radiologist_id") REFERENCES "Radiologist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "Study"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
