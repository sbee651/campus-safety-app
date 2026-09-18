using CampusSafety.Core;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CampusSafety.Core
{
    /// <summary>
    /// The result your front-end shows the student after they trigger the panic button.
    /// </summary>
    public class PanicAlertResult
    {
        public bool Success { get; set; }
        public string ConfirmationMessage { get; set; } = "";
        public EmergencyAlert? Alert { get; set; }
        public List<string> NotifiedContacts { get; set; } = new();
    }

    /// <summary>
    /// Core backend logic for the panic button (FR2), trusted-contact notification (FR5),
    /// and the responder dashboard feed (FR10). All notifications are simulated per the
    /// hackathon's "dummy data only" rule — nothing here sends a real SMS/call/email.
    /// </summary>
    public static class EmergencyService
    {
        /// <summary>
        /// Call this AFTER your UI's hold/confirm countdown has completed
        /// (e.g. "Hold for 3 seconds" or "Sending in 5s, tap cancel").
        /// Do not call this the instant the button is first tapped.
        /// </summary>
        public static PanicAlertResult TriggerPanicAlert(string studentId, string zoneId)
        {
            var student = DataStore.GetStudent(studentId);
            var zone = DataStore.GetZone(zoneId) ?? new CampusZone { ZoneName = "Unknown location" };

            if (student == null)
            {
                return new PanicAlertResult
                {
                    Success = false,
                    ConfirmationMessage = "Could not identify student record (demo data)."
                };
            }

            var alert = new EmergencyAlert
            {
                AlertId = DataStore.NextAlertId(),
                StudentId = student.StudentId,
                AlertType = AlertType.PanicAlert,
                Location = zone,
                TimeTriggered = DateTime.Now,
                Status = AlertStatus.New,
                ConfirmationMessage = "Help request sent. Campus security has been notified in this simulation."
            };

            DataStore.EmergencyAlerts.Add(alert);

            alert.Notes.Add($"[{DateTime.Now:HH:mm}] Campus security notified (simulated).");

            var notified = new List<string>();
            foreach (var contact in student.TrustedContacts)
            {
                notified.Add(contact.Name);
                alert.Notes.Add(
                    $"[{DateTime.Now:HH:mm}] {contact.Name} notified via {contact.PreferredMethod} (simulated). " +
                    $"Message: \"{student.Name} has triggered a safety alert. Last known location: {zone.ZoneName}.\"");
            }

            return new PanicAlertResult
            {
                Success = true,
                ConfirmationMessage = alert.ConfirmationMessage,
                Alert = alert,
                NotifiedContacts = notified
            };
        }

        public static string CancelPanicAlert() =>
            "Emergency alert cancelled. No one has been notified.";

        public static List<EmergencyAlert> GetActiveAlerts() =>
            DataStore.EmergencyAlerts
                .Where(a => a.Status != AlertStatus.Resolved && a.Status != AlertStatus.FalseAlarm)
                .OrderByDescending(a => a.TimeTriggered)
                .ToList();

        public static bool UpdateAlertStatus(string alertId, AlertStatus newStatus, string? responderName = null)
        {
            var alert = DataStore.EmergencyAlerts.FirstOrDefault(a => a.AlertId == alertId);
            if (alert == null) return false;

            alert.Status = newStatus;
            if (!string.IsNullOrEmpty(responderName))
                alert.AssignedResponder = responderName;

            alert.Notes.Add($"[{DateTime.Now:HH:mm}] Status changed to {newStatus}" +
                             (responderName != null ? $" by {responderName}." : "."));
            return true;
        }

        public static IncidentReport SubmitIncidentReport(
            string reportType, string location, string description,
            bool anonymous = false, bool followUpRequested = false)
        {
            var report = new IncidentReport
            {
                ReportId = DataStore.NextReportId(),
                ReportType = reportType,
                Location = location,
                DateTime = DateTime.Now,
                Description = description,
                IsAnonymous = anonymous,
                FollowUpRequested = followUpRequested,
                Status = AlertStatus.New
            };
            DataStore.IncidentReports.Add(report);
            return report;
        }
    }
}