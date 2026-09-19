param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

function Invoke-Json {
  param(
    [string]$Method = "GET",
    [string]$Path,
    [object]$Body = $null,
    [int[]]$AllowedStatus = @(200)
  )

  try {
    $params = @{
      Method = $Method
      Uri = "$BaseUrl$Path"
    }
    if ($null -ne $Body) {
      $params.ContentType = "application/json"
      $params.Body = ($Body | ConvertTo-Json -Depth 8)
    }
    $result = Invoke-RestMethod @params
    $status = 200
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $raw = $_.ErrorDetails.Message
      if (-not $raw) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $raw = $reader.ReadToEnd()
      }
      $result = if ($raw) { $raw | ConvertFrom-Json } else { $null }
    } else {
      throw
    }
  }

  if ($AllowedStatus -notcontains $status) {
    throw "$Method $Path returned $status, expected one of $($AllowedStatus -join ', ')"
  }
  return @{ Status = $status; Body = $result }
}

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

$health = Invoke-Json -Path "/api/health"
Assert-True ($health.Body.status -eq "ok") "Health response must be { status: 'ok' }."

$coverage = Invoke-Json -Path "/api/patrol-coverage"
Assert-True ($coverage.Body.areas.Count -gt 0) "Patrol coverage must return areas."

$badSignup = Invoke-Json -Method POST -Path "/api/signup" -AllowedStatus @(422) -Body @{
  name = ""
  email = "bad@example.com"
  studentNo = "123"
  password = "short"
  area = "Walmer"
  patrolProvider = "atlas"
  termsAccepted = $false
}
Assert-True ($null -ne $badSignup.Body.errors.email) "Signup validation must include errors.email."
Assert-True ($null -ne $badSignup.Body.errors.studentNo) "Signup validation must include errors.studentNo."
Assert-True ($null -ne $badSignup.Body.errors.terms) "Signup validation must include errors.terms."

$badSignin = Invoke-Json -Method POST -Path "/api/signin" -AllowedStatus @(422) -Body @{
  email = "bad@example.com"
  password = ""
}
Assert-True ($null -ne $badSignin.Body.errors.email) "Signin validation must include errors.email."

$badReset = Invoke-Json -Method POST -Path "/api/reset-password" -AllowedStatus @(400) -Body @{
  token = "not-a-token"
  password = "StrongPass123"
}
Assert-True ($null -ne $badReset.Body.error) "Invalid reset token must return a generic error."

$notify = Invoke-Json -Method POST -Path "/api/notify-emergency" -Body @{
  studentName = "Contract Test"
  studentNo = "229180000"
  emergencyType = "safe-walk-start"
  location = "Library Walkway"
  recipients = @()
}
Assert-True ($notify.Body.sent -eq $false) "Empty recipients should be a clean sent:false no-op."

$unauthContact = Invoke-Json -Method POST -Path "/api/contacts" -AllowedStatus @(401) -Body @{
  name = "Guardian"
  phone = "+27 82 000 0000"
  email = "guardian@example.com"
  relation = "Friend"
}
Assert-True ($null -ne $unauthContact.Body.error) "Contacts endpoint must require a signed-in student."

$unauthSafeWalk = Invoke-Json -Method POST -Path "/api/safewalk/notify" -AllowedStatus @(401) -Body @{
  zone = "Library Walkway"
  startedAt = (Get-Date).ToString("o")
}
Assert-True ($null -ne $unauthSafeWalk.Body.error) "Safe Walk notify endpoint must require a signed-in student."

Write-Host "API contract smoke tests passed."
