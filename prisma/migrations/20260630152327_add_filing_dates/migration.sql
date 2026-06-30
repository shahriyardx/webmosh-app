-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "accounts_filing_due" TIMESTAMP(3),
ADD COLUMN     "confirmation_statement_due" TIMESTAMP(3),
ADD COLUMN     "federal_filing_due" TIMESTAMP(3),
ADD COLUMN     "state_filing_due" TIMESTAMP(3),
ADD COLUMN     "state_tax_due" TIMESTAMP(3);
