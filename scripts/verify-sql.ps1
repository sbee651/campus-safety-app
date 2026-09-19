param(
  [string]$Server = "(localdb)\MSSQLLocalDB",
  [string]$Database = "CampusSafetyApp"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $root "SQLQuery1.sql"

if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
  throw "sqlcmd is not installed or is not on PATH."
}

Write-Host "Running SQLQuery1.sql against $Server ..."
sqlcmd -S $Server -E -i $scriptPath -b

Write-Host "Running SQLQuery1.sql a second time to verify idempotency ..."
sqlcmd -S $Server -E -i $scriptPath -b

Write-Host "Checking required columns and seed data ..."
sqlcmd -S $Server -E -d $Database -b -Q @"
SELECT
  COL_LENGTH(N'dbo.Student', N'Email') AS StudentEmailColumn,
  COL_LENGTH(N'dbo.Student', N'StudentNumber') AS StudentNumberColumn,
  COL_LENGTH(N'dbo.Student', N'PasswordHash') AS PasswordHashColumn,
  COL_LENGTH(N'dbo.Student', N'TermsAcceptedAt') AS TermsAcceptedAtColumn,
  COL_LENGTH(N'dbo.TrustedContact', N'ContactType') AS ContactTypeColumn,
  COL_LENGTH(N'dbo.EmergencyAlert', N'AcknowledgedAt') AS AcknowledgedAtColumn;

SELECT StudentID, Name, Email, StudentNumber, TermsAcceptedAt
FROM dbo.Student
WHERE Email IN (N'demo.student@mandela.ac.za', N'jane.doe@mandela.ac.za')
ORDER BY StudentID;
"@

Write-Host "SQL verification completed."
