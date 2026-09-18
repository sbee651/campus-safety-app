using System;
using System.Collections.Generic;
using System.Linq;

namespace CampusSafety.Core
{
    /// <summary>
    /// Single shared in-memory "database" for the prototype.
    /// Static so both the front-end forms and backend services
    /// read/write the same data during one running instance of the app.
    /// All data here is dummy/sample data only, per hackathon rules.
    /// </summary>
    public static class DataStore
    {
        public static List<Student> Students { get; } = new();
        public static List<CampusZone> Zones { get; } = new();
        public static List<EmergencyAlert> EmergencyAlerts { get; } = new();
        public static List<SafetyAlert> SafetyAlerts { get; } = new();
        public static List<IncidentReport> IncidentReports { get; } = new();
        public static List<Responder> Responders { get; } = new();

        // Simple counters to generate readable IDs like EA001, SA002, IR003
        private static int _alertCounter = 0;
        private static int _safetyAlertCounter = 0;
        private static int _reportCounter = 0;

        public static string NextAlertId() => $"EA{(++_alertCounter):D3}";
        public static string NextSafetyAlertId() => $"SA{(++_safetyAlertCounter):D3}";
        public static string NextReportId() => $"IR{(++_reportCounter):D3}";

        /// <summary>Call once at app startup (e.g. in Program.cs / Form1 constructor).</summary>
        public static void SeedDummyData()
        {
            if (Students.Any()) return; // already seeded

            var libraryZone = new CampusZone
            {
                ZoneId = "Z1",
                ZoneName = "Library Walkway",
                Description = "Path between the library and student centre",
                RiskStatus = "Normal",
                NearestHelpPoint = "Library Security Desk"
            };
            var parkingZone = new CampusZone
            {
                ZoneId = "Z2",
                ZoneName = "South Campus Parking Zone",
                Description = "Main student parking area",
                RiskStatus = "Caution - low lighting",
                NearestHelpPoint = "Parking Security Booth"
            };
            Zones.AddRange(new[] { libraryZone, parkingZone });

            var demoStudent = new Student
            {
                StudentId = "S001",
                Name = "Demo Student",
                Programme = "BSc Software Development",
                TrustedContacts = new List<TrustedContact>
                {
                    new TrustedContact
                    {
                        ContactId = "TC1",
                        Name = "Demo Contact",
                        Relationship = "Friend",
                        PhoneNumber = "000-000-0000",
                        Email = "demo.contact@example.com",
                        PreferredMethod = PreferredAlertMethod.SMS
                    }
                }
            };
            Students.Add(demoStudent);

            Responders.Add(new Responder
            {
                ResponderId = "R1",
                Name = "Demo Responder",
                Role = "Campus Security",
                ContactDetails = "Ext. 3196",
                IsAvailable = true
            });

            SafetyAlerts.Add(new SafetyAlert
            {
                AlertId = NextSafetyAlertId(),
                Title = "Caution: Low Lighting Near Parking Area",
                Message = "Students are advised to walk in groups and use well-lit routes while maintenance is being addressed.",
                AffectedArea = parkingZone.ZoneName,
                DateTime = DateTime.Now,
                Level = SafetyAlertLevel.Caution,
                RecommendedAction = "Walk in groups; use well-lit routes."
            });
        }

        public static Student? GetStudent(string studentId) =>
            Students.FirstOrDefault(s => s.StudentId == studentId);

        public static CampusZone? GetZone(string zoneId) =>
            Zones.FirstOrDefault(z => z.ZoneId == zoneId);
    }
}