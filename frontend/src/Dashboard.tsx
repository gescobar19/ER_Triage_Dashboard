import React, { useEffect, useState } from "react";
import {
  Container, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Box, Chip, TextField,
  Button
} from "@mui/material";
import { postTriage, addPatient } from "./api";

interface Patient {
  id: string;
  name: string;
  severity?: "critical" | "medium" | "low"; // backend can assign
  symptoms: string;
  arrival_time: string;
  treatment_duration: number;
}

interface Staff {
  id: string;
  name: string;
  specialization: string;
  available: boolean;
}

interface Assignment {
  patient_id: string;
  doctor_id: string | null;
  wait_time_minutes: number;
}

interface TriageResult {
  triage_order: string[];
  assignments: Assignment[];
  summary: string;
}

export default function Dashboard() {
  const [data, setData] = useState<TriageResult | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [newPatient, setNewPatient] = useState({
    id: "",
    name: "",
    symptoms: "",
    treatment_duration: 20
  });

  const severityColors: Record<string, string> = {
    critical: "#ffcccc",
    medium: "#fff3cd",
    low: "#d4edda"
  };

  // --- Add new patient (manual) ---
  const handleAddPatient = async () => {
    const patientInput = { ...newPatient, arrival_time: new Date().toISOString() };
    try {
      const savedPatient = await addPatient(patientInput); 
      const patientWithSeverity = savedPatient.patient || savedPatient; // ensure severity from backend
      setPatients((prev) => [...prev, patientWithSeverity]);
      setNewPatient({ id: "", name: "", symptoms: "", treatment_duration: 20 });
    } catch (err) {
      console.error("Error adding patient:", err);
    }
  };

  // --- Initial demo data ---
  useEffect(() => {
    const initialPatients: Patient[] = [
      {
        id: "P1",
        name: "Alice",
        symptoms: "chest pain and dizziness",
        severity: "critical",
        arrival_time: new Date().toISOString(),
        treatment_duration: 30
      }
    ];
    const initialStaff: Staff[] = [
      { id: "D1", name: "Dr. Lee", specialization: "general", available: true },
      { id: "D2", name: "Dr. Patel", specialization: "cardiology", available: true }
    ];
    setPatients(initialPatients);
    setStaff(initialStaff);
  }, []);

  // --- Fetch triage results ---
  useEffect(() => {
    if (patients.length && staff.length) {
      postTriage(patients, staff)
        .then((res) => setData(res.result))
        .catch((err) => console.error("API error:", err));
    }
  }, [patients, staff]);

  // --- Automatic patient arrivals ---
  useEffect(() => {
    const interval = setInterval(() => {
      const randomId = "P" + Math.floor(Math.random() * 1000);
      const symptomsList = [
        "severe chest pain",
        "fever and chills",
        "shortness of breath",
        "abdominal pain",
        "head injury",
        "broken arm",
        "persistent cough"
      ];
      const randomSymptoms =
        symptomsList[Math.floor(Math.random() * symptomsList.length)];

      const newAutoPatient: Patient = {
        id: randomId,
        name: `Patient ${randomId}`,
        symptoms: randomSymptoms,
        arrival_time: new Date().toISOString(),
        treatment_duration: Math.floor(Math.random() * 30) + 10
      };

      // Add via backend to get severity
      addPatient(newAutoPatient)
        .then((savedPatient) => {
          const patientWithSeverity = savedPatient.patient || savedPatient;
          setPatients((prev) => [...prev, patientWithSeverity]);
          console.log(`🩺 Auto-added ${patientWithSeverity.name}: ${patientWithSeverity.symptoms} (${patientWithSeverity.severity})`);
        })
        .catch((err) => console.error("Auto-add error:", err));
    }, 30000); // every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (!data) return <Typography sx={{ mt: 4 }}>Loading...</Typography>;

  const severityRank = { critical: 0, medium: 1, low: 2 };
  const sortedPatients = [...data.triage_order].sort((a, b) => {
    const pa = patients.find((p) => p.id === a);
    const pb = patients.find((p) => p.id === b);
    return (pa ? severityRank[pa.severity ?? "low"] : 3) -
           (pb ? severityRank[pb.severity ?? "low"] : 3);
  });

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>🚑 ER Triage Dashboard</Typography>

      {/* --- Add New Patient Form --- */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6">Add New Patient</Typography>
        <Box sx={{ display: "flex", gap: 2, mt: 2, flexWrap: "wrap" }}>
          <TextField
            label="ID"
            value={newPatient.id}
            onChange={(e) => setNewPatient({ ...newPatient, id: e.target.value })}
          />
          <TextField
            label="Name"
            value={newPatient.name}
            onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
          />
          <TextField
            label="Symptoms"
            value={newPatient.symptoms}
            onChange={(e) => setNewPatient({ ...newPatient, symptoms: e.target.value })}
            fullWidth
          />
          <TextField
            label="Treatment (min)"
            type="number"
            value={newPatient.treatment_duration}
            onChange={(e) =>
              setNewPatient({ ...newPatient, treatment_duration: Number(e.target.value) })
            }
          />
          <Button variant="contained" onClick={handleAddPatient}>Add</Button>
        </Box>
      </Paper>

      {/* --- Patient Queue --- */}
      <Typography variant="h6" gutterBottom>Patient Queue</Typography>
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Patient</TableCell>
              <TableCell>Symptoms</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Arrival Time</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedPatients.map((pid) => {
              const patient = patients.find((p) => p.id === pid);
              const assign = data.assignments.find((a) => a.patient_id === pid);
              const status = assign ? "In Treatment" : "Waiting";
              return (
                <TableRow key={pid}>
                  <TableCell>{patient?.name || pid}</TableCell>
                  <TableCell>{patient?.symptoms}</TableCell>
                  <TableCell>
                    {patient?.severity && (
                      <Chip
                        label={patient.severity.toUpperCase()}
                        sx={{ bgcolor: severityColors[patient.severity], color: "#000" }}
                      />
                    )}
                  </TableCell>
                  <TableCell>{patient ? new Date(patient.arrival_time).toLocaleTimeString() : "-"}</TableCell>
                  <TableCell>{status}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* --- Staff Assignments --- */}
      <Typography variant="h6" gutterBottom>Staff Assignments</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Doctor</TableCell>
              <TableCell>Current Patient</TableCell>
              <TableCell>Wait Time (min)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.assignments.map((a, idx) => {
              const doctor = staff.find((s) => s.id === a.doctor_id);
              const patient = patients.find((p) => p.id === a.patient_id);
              return (
                <TableRow key={idx}>
                  <TableCell>{doctor?.name || "N/A"}</TableCell>
                  <TableCell>{patient?.name || a.patient_id}</TableCell>
                  <TableCell>{a.wait_time_minutes}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* --- Summary --- */}
      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="subtitle1">{data.summary}</Typography>
      </Paper>
    </Container>
  );
}
