/*
Vigil production data model prototype.

This script is intentionally idempotent and non-destructive: it creates the
database and tables only when they do not already exist, preserves existing
data, migrates older time-column names when found, and guards sample inserts
so repeated runs do not create duplicate seed rows.
*/

IF DB_ID(N'CampusSafetyApp') IS NULL
BEGIN
    CREATE DATABASE CampusSafetyApp;
END;
GO

USE CampusSafetyApp;
GO

IF OBJECT_ID(N'dbo.Student', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Student (
        StudentID INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(100),
        Email NVARCHAR(100),
        StudentNumber CHAR(9),
        PasswordHash NVARCHAR(255),
        TermsAcceptedAt DATETIME,
        Programme NVARCHAR(100),
        EmergencyPreference NVARCHAR(50),
        CONSTRAINT CK_Student_Email_Mandela CHECK (Email IS NULL OR LOWER(Email) LIKE N'%@mandela.ac.za'),
        CONSTRAINT CK_Student_StudentNumber_NineDigits CHECK (StudentNumber IS NULL OR StudentNumber LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
        CONSTRAINT UQ_Student_Email UNIQUE (Email),
        CONSTRAINT UQ_Student_StudentNumber UNIQUE (StudentNumber)
    );
END;
GO

IF COL_LENGTH(N'dbo.Student', N'Email') IS NULL
BEGIN
    ALTER TABLE dbo.Student ADD Email NVARCHAR(100) NULL;
END;

IF COL_LENGTH(N'dbo.Student', N'StudentNumber') IS NULL
BEGIN
    ALTER TABLE dbo.Student ADD StudentNumber CHAR(9) NULL;
END;

IF COL_LENGTH(N'dbo.Student', N'PasswordHash') IS NULL
BEGIN
    ALTER TABLE dbo.Student ADD PasswordHash NVARCHAR(255) NULL;
END;

IF COL_LENGTH(N'dbo.Student', N'TermsAcceptedAt') IS NULL
BEGIN
    ALTER TABLE dbo.Student ADD TermsAcceptedAt DATETIME NULL;
END;
GO

UPDATE dbo.Student
SET
    Email = COALESCE(Email, LOWER(CONCAT(N'student', StudentID, N'@mandela.ac.za'))),
    StudentNumber = COALESCE(StudentNumber, RIGHT(CONCAT(N'000000000', 200000000 + StudentID), 9));
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_Student_Email_Mandela'
      AND parent_object_id = OBJECT_ID(N'dbo.Student')
)
BEGIN
    ALTER TABLE dbo.Student
    ADD CONSTRAINT CK_Student_Email_Mandela
    CHECK (Email IS NULL OR LOWER(Email) LIKE N'%@mandela.ac.za');
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_Student_StudentNumber_NineDigits'
      AND parent_object_id = OBJECT_ID(N'dbo.Student')
)
BEGIN
    ALTER TABLE dbo.Student
    ADD CONSTRAINT CK_Student_StudentNumber_NineDigits
    CHECK (StudentNumber IS NULL OR StudentNumber LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]');
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE name = N'UQ_Student_Email'
      AND parent_object_id = OBJECT_ID(N'dbo.Student')
)
BEGIN
    ALTER TABLE dbo.Student
    ADD CONSTRAINT UQ_Student_Email UNIQUE (Email);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE name = N'UQ_Student_StudentNumber'
      AND parent_object_id = OBJECT_ID(N'dbo.Student')
)
BEGIN
    ALTER TABLE dbo.Student
    ADD CONSTRAINT UQ_Student_StudentNumber UNIQUE (StudentNumber);
END;
GO

IF OBJECT_ID(N'dbo.TrustedContact', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrustedContact (
        ContactID INT PRIMARY KEY IDENTITY(1,1),
        StudentID INT FOREIGN KEY REFERENCES dbo.Student(StudentID),
        
        Name NVARCHAR(100),
        Relationship NVARCHAR(50),
        Phone NVARCHAR(20),
        Email NVARCHAR(100),
        PreferredAlertMethod NVARCHAR(50),
        ContactType NVARCHAR(30) NOT NULL CONSTRAINT DF_TrustedContact_ContactType DEFAULT N'personal'
    );
END;
GO

IF COL_LENGTH(N'dbo.TrustedContact', N'ContactType') IS NULL
BEGIN
    ALTER TABLE dbo.TrustedContact
    ADD ContactType NVARCHAR(30) NOT NULL
        CONSTRAINT DF_TrustedContact_ContactType DEFAULT N'personal';
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_TrustedContact_ContactType'
      AND parent_object_id = OBJECT_ID(N'dbo.TrustedContact')
)
BEGIN
    ALTER TABLE dbo.TrustedContact
    ADD CONSTRAINT CK_TrustedContact_ContactType
    CHECK (ContactType IN (N'personal', N'security-patrol'));
END;
GO

IF OBJECT_ID(N'dbo.EmergencyAlert', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EmergencyAlert (
        AlertID INT PRIMARY KEY IDENTITY(1,1),
        StudentID INT FOREIGN KEY REFERENCES dbo.Student(StudentID),
        AlertType NVARCHAR(50),
        Location NVARCHAR(100),
        TriggeredAt DATETIME,
        AcknowledgedAt DATETIME,
        Status NVARCHAR(50),
        AssignedResponder NVARCHAR(100),
        Notes NVARCHAR(MAX)
    );
END
ELSE IF COL_LENGTH(N'dbo.EmergencyAlert', N'TimeTriggered') IS NOT NULL
     AND COL_LENGTH(N'dbo.EmergencyAlert', N'TriggeredAt') IS NULL
BEGIN
    EXEC sp_rename N'dbo.EmergencyAlert.TimeTriggered', N'TriggeredAt', N'COLUMN';
END;
GO

IF COL_LENGTH(N'dbo.EmergencyAlert', N'AcknowledgedAt') IS NULL
BEGIN
    ALTER TABLE dbo.EmergencyAlert ADD AcknowledgedAt DATETIME NULL;
END;
GO

IF OBJECT_ID(N'dbo.SafetyAlert', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SafetyAlert (
        AlertID INT PRIMARY KEY IDENTITY(1,1),
        Title NVARCHAR(100),
        Message NVARCHAR(MAX),
        AffectedArea NVARCHAR(100),
        AlertDateTime DATETIME,
        AlertLevel NVARCHAR(20),
        RecommendedAction NVARCHAR(200)
    );
END
ELSE IF COL_LENGTH(N'dbo.SafetyAlert', N'DateTime') IS NOT NULL
     AND COL_LENGTH(N'dbo.SafetyAlert', N'AlertDateTime') IS NULL
BEGIN
    EXEC sp_rename N'dbo.SafetyAlert.DateTime', N'AlertDateTime', N'COLUMN';
END;
GO

IF OBJECT_ID(N'dbo.IncidentReport', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.IncidentReport (
        ReportID INT PRIMARY KEY IDENTITY(1,1),
        StudentID INT FOREIGN KEY REFERENCES dbo.Student(StudentID),
        ReportType NVARCHAR(50),
        Location NVARCHAR(100),
        ReportedAt DATETIME,
        Description NVARCHAR(MAX),
        FollowUpRequested BIT,
        Status NVARCHAR(50)
    );
END
ELSE IF COL_LENGTH(N'dbo.IncidentReport', N'DateTime') IS NOT NULL
     AND COL_LENGTH(N'dbo.IncidentReport', N'ReportedAt') IS NULL
BEGIN
    EXEC sp_rename N'dbo.IncidentReport.DateTime', N'ReportedAt', N'COLUMN';
END;
GO

IF OBJECT_ID(N'dbo.Responder', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Responder (
        ResponderID INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(100),
        Role NVARCHAR(50),
        ContactDetails NVARCHAR(100),
        AvailabilityStatus NVARCHAR(50)
    );
END;
GO

IF OBJECT_ID(N'dbo.CampusZone', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CampusZone (
        ZoneID INT PRIMARY KEY IDENTITY(1,1),
        ZoneName NVARCHAR(100),
        Description NVARCHAR(MAX),
        RiskStatus NVARCHAR(50),
        NearestHelpPoint NVARCHAR(100),
        MapReference NVARCHAR(100)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Student WHERE Name = N'Demo Student')
BEGIN
    INSERT INTO dbo.Student (Name, Email, StudentNumber, PasswordHash, TermsAcceptedAt, Programme, EmergencyPreference)
    VALUES (N'Demo Student', N'demo.student@mandela.ac.za', N'229180000', NULL, GETDATE(), N'Computer Science', N'SMS');
END
ELSE
BEGIN
    UPDATE dbo.Student
    SET Email = N'demo.student@mandela.ac.za',
        StudentNumber = N'229180000'
    WHERE Name = N'Demo Student';
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Student WHERE Name = N'Jane Doe')
BEGIN
    INSERT INTO dbo.Student (Name, Email, StudentNumber, PasswordHash, TermsAcceptedAt, Programme, EmergencyPreference)
    VALUES (N'Jane Doe', N'jane.doe@mandela.ac.za', N'229180001', NULL, GETDATE(), N'Information Technology', N'Email');
END
ELSE
BEGIN
    UPDATE dbo.Student
    SET Email = N'jane.doe@mandela.ac.za',
        StudentNumber = N'229180001'
    WHERE Name = N'Jane Doe';
END;

UPDATE dbo.Student
SET TermsAcceptedAt = COALESCE(TermsAcceptedAt, GETDATE())
WHERE Name IN (N'Demo Student', N'Jane Doe');
GO

DECLARE @DemoStudentID INT = (SELECT TOP 1 StudentID FROM dbo.Student WHERE Name = N'Demo Student' ORDER BY StudentID);
DECLARE @JaneStudentID INT = (SELECT TOP 1 StudentID FROM dbo.Student WHERE Name = N'Jane Doe' ORDER BY StudentID);

IF @DemoStudentID IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.TrustedContact WHERE StudentID = @DemoStudentID AND Name = N'John Doe')
BEGIN
    INSERT INTO dbo.TrustedContact (StudentID, Name, Relationship, Phone, Email, PreferredAlertMethod, ContactType)
    VALUES (@DemoStudentID, N'John Doe', N'Friend', N'0712345678', N'john@example.com', N'SMS', N'personal');
END;

IF @JaneStudentID IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.TrustedContact WHERE StudentID = @JaneStudentID AND Name = N'Mary Smith')
BEGIN
    INSERT INTO dbo.TrustedContact (StudentID, Name, Relationship, Phone, Email, PreferredAlertMethod, ContactType)
    VALUES (@JaneStudentID, N'Mary Smith', N'Sister', N'0823456789', N'mary@example.com', N'Email', N'personal');
END;
GO

DECLARE @DemoStudentID INT = (SELECT TOP 1 StudentID FROM dbo.Student WHERE Name = N'Demo Student' ORDER BY StudentID);
DECLARE @JaneStudentID INT = (SELECT TOP 1 StudentID FROM dbo.Student WHERE Name = N'Jane Doe' ORDER BY StudentID);

IF @DemoStudentID IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.EmergencyAlert WHERE StudentID = @DemoStudentID AND AlertType = N'Panic Alert')
BEGIN
    INSERT INTO dbo.EmergencyAlert (StudentID, AlertType, Location, TriggeredAt, Status, AssignedResponder, Notes)
    VALUES (@DemoStudentID, N'Panic Alert', N'Near Library Walkway', GETDATE(), N'New', N'Security Officer A', N'Help request sent.');
END;

IF @JaneStudentID IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.EmergencyAlert WHERE StudentID = @JaneStudentID AND AlertType = N'Journey Alert')
BEGIN
    INSERT INTO dbo.EmergencyAlert (StudentID, AlertType, Location, TriggeredAt, Status, AssignedResponder, Notes)
    VALUES (@JaneStudentID, N'Journey Alert', N'South Campus Parking Zone', GETDATE(), N'Acknowledged', N'Security Officer B', N'Student requested monitoring.');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SafetyAlert WHERE Title = N'Caution: Low Lighting')
BEGIN
    INSERT INTO dbo.SafetyAlert (Title, Message, AffectedArea, AlertDateTime, AlertLevel, RecommendedAction)
    VALUES (N'Caution: Low Lighting', N'Students are advised to walk in groups and use well-lit routes.', N'South Campus Parking Zone', GETDATE(), N'Caution', N'Use main walkway');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.SafetyAlert WHERE Title = N'Urgent: Suspicious Activity')
BEGIN
    INSERT INTO dbo.SafetyAlert (Title, Message, AffectedArea, AlertDateTime, AlertLevel, RecommendedAction)
    VALUES (N'Urgent: Suspicious Activity', N'Avoid the east gate area until further notice.', N'East Gate', GETDATE(), N'Urgent', N'Stay away from east gate');
END;
GO

DECLARE @DemoStudentID INT = (SELECT TOP 1 StudentID FROM dbo.Student WHERE Name = N'Demo Student' ORDER BY StudentID);
DECLARE @JaneStudentID INT = (SELECT TOP 1 StudentID FROM dbo.Student WHERE Name = N'Jane Doe' ORDER BY StudentID);

IF @DemoStudentID IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.IncidentReport WHERE StudentID = @DemoStudentID AND ReportType = N'Safety Concern')
BEGIN
    INSERT INTO dbo.IncidentReport (StudentID, ReportType, Location, ReportedAt, Description, FollowUpRequested, Status)
    VALUES (@DemoStudentID, N'Safety Concern', N'Library Walkway', GETDATE(), N'Low lighting makes area unsafe.', 1, N'Open');
END;

IF @JaneStudentID IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.IncidentReport WHERE StudentID = @JaneStudentID AND ReportType = N'Incident')
BEGIN
    INSERT INTO dbo.IncidentReport (StudentID, ReportType, Location, ReportedAt, Description, FollowUpRequested, Status)
    VALUES (@JaneStudentID, N'Incident', N'Residence Hall', GETDATE(), N'Unidentified person loitering near entrance.', 0, N'Under Review');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Responder WHERE Name = N'Security Officer A')
BEGIN
    INSERT INTO dbo.Responder (Name, Role, ContactDetails, AvailabilityStatus)
    VALUES (N'Security Officer A', N'Campus Security', N'securityA@campus.edu', N'Available');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Responder WHERE Name = N'Security Officer B')
BEGIN
    INSERT INTO dbo.Responder (Name, Role, ContactDetails, AvailabilityStatus)
    VALUES (N'Security Officer B', N'Campus Security', N'securityB@campus.edu', N'On Duty');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.CampusZone WHERE ZoneName = N'Library Walkway')
BEGIN
    INSERT INTO dbo.CampusZone (ZoneName, Description, RiskStatus, NearestHelpPoint, MapReference)
    VALUES (N'Library Walkway', N'Path between library and main hall', N'Medium', N'Library Security Desk', N'Zone A');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.CampusZone WHERE ZoneName = N'South Campus Parking Zone')
BEGIN
    INSERT INTO dbo.CampusZone (ZoneName, Description, RiskStatus, NearestHelpPoint, MapReference)
    VALUES (N'South Campus Parking Zone', N'Parking area with low lighting', N'High', N'Parking Security Booth', N'Zone B');
END;
GO
