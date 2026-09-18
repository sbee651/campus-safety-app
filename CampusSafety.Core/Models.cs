using System;
using System.Collections.Generic;

namespace CampusSafety.Core
{
    // ---------- Enums ----------

    public enum UserRole
    {
        Student,
        CampusSecurity,
        StudentSupportStaff,
        Administrator
    }

    public enum AlertType
    {
        PanicAlert,
        WalkWithMeTimeout,
        IncidentReport
    }

    public enum AlertStatus
    {
        New,
        Acknowledged,
        ResponderDispatched,
        Resolved,
        FalseAlarm
    }

    public enum SafetyAlertLevel
    {
        Information,
        Caution,
        Urgent
    }

    public enum PreferredAlertMethod
    {
        SMS,
        Email,
        Call
    }

    // ---------- Core entities ----------

    public class Student
    {
        public string StudentId { get; set; } = "";
        public string Name { get; set; } = "";      // dummy data only
        public string Programme { get; set; } = "";
        public List<TrustedContact> TrustedContacts { get; set; } = new();
    }

    public class TrustedContact
    {
        public string ContactId { get; set; } = "";
        public string Name { get; set; } = "";
        public string Relationship { get; set; } = "";
        public string PhoneNumber { get; set; } = "";
        public string Email { get; set; } = "";
        public PreferredAlertMethod PreferredMethod { get; set; } = PreferredAlertMethod.SMS;
    }

    public class CampusZone
    {
        public string ZoneId { get; set; } = "";
        public string ZoneName { get; set; } = "";
        public string Description { get; set; } = "";
        public string RiskStatus { get; set; } = "Normal";
        public string NearestHelpPoint { get; set; } = "";
    }

    public class EmergencyAlert
    {
        public string AlertId { get; set; } = "";
        public string StudentId { get; set; } = "";       // or anonymous ID
        public AlertType AlertType { get; set; }
        public CampusZone Location { get; set; } = new();
        public DateTime TimeTriggered { get; set; }
        public AlertStatus Status { get; set; } = AlertStatus.New;
        public string AssignedResponder { get; set; } = "";
        public List<string> Notes { get; set; } = new();
        public string ConfirmationMessage { get; set; } = "";
    }

    public class SafetyAlert
    {
        public string AlertId { get; set; } = "";
        public string Title { get; set; } = "";
        public string Message { get; set; } = "";
        public string AffectedArea { get; set; } = "";
        public DateTime DateTime { get; set; }
        public SafetyAlertLevel Level { get; set; }
        public string RecommendedAction { get; set; } = "";
    }

    public class IncidentReport
    {
        public string ReportId { get; set; } = "";
        public string ReportType { get; set; } = "";
        public string Location { get; set; } = "";
        public DateTime DateTime { get; set; }
        public string Description { get; set; } = "";
        public bool FollowUpRequested { get; set; }
        public bool IsAnonymous { get; set; }
        public AlertStatus Status { get; set; } = AlertStatus.New;
    }

    public class Responder
    {
        public string ResponderId { get; set; } = "";
        public string Name { get; set; } = "";
        public string Role { get; set; } = "Campus Security";
        public string ContactDetails { get; set; } = "";
        public bool IsAvailable { get; set; } = true;
    }
}