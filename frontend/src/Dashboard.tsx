import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Grid,
  Card,
  CardContent
} from "@mui/material";
import { postTriage } from "./api";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([
    { id: "P1", name: "Alice", severity: "critical", arrival_time: new Date().toISOString(), treatment_duration: 30 }
  ]);
  const [staff, setStaff] = useState<any[]>([
    { id: "D1", name: "Dr. Lee", specialization: "general", available: true }
  ]);

  const severityColor = (severity: string) =>
    severity === "critical" ? "#ffebee" :
    severity === "medium" ? "#fff3e0" :
    severity === "low" ? "#e8f5e9" : "inherit";

  const fetchTriage = async () => {
    const result = await postTriage(patients, staff);
    setData(result);
  };

  // Function to simulate new patient arrival
  const addRandomPatient = () => {
    const id = `P${patients.length + 1}`;
    const names = ["Bob", "Carol", "Dave", "Eve", "Frank"];
    const severities: ("critical" | "medium" | "low")[] = ["critical", "medium", "low"];
    const patient = {
      id,
      name: names[Math.floor(Math.random() * names.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      arrival_time: new Date().toISOString(),
      treatment_duration: 20 + Math.floor(Math.random() * 20) // 20–40 min
    };
    setPatients((prev) => [...prev, patient]);
  };

  useEffect(() => {
    fetchTriage();

    // Refresh triage every 30 seconds
    const refreshInterval = setInterval(fetchTriage, 30000);

    // Add a new patient every 1–2 minutes
    const simulationInterval = setInterval(addRandomPatient, 60000 + Math.random() * 60000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(simulationInterval);
    };
  }, [patients]);

  if (!data) return <Typography variant="h6">Loading...</Typography>;

  const { triage_order, assignments, summary } = data.result;

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h3" gutterBottom>🚑 ER Triage Dashboard</Typography>

      {/* Patient Queue */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>Patient Queue</Typography>
        <Box sx={{ overflowX: "auto" }}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Patient</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {triage_order.map((pid: string) => {
                  const assign = assignments.find((a: any) => a.patient_id === pid);
                  const patient = patients.find((p) => p.id === pid);
                  const status = assign ? "In Treatment" : "Waiting";
                  return (
                    <TableRow key={pid} sx={{ bgcolor: severityColor(patient?.severity || "") }}>
                      <TableCell>{patient?.name || pid}</TableCell>
                      <TableCell>{patient?.severity}</TableCell>
                      <TableCell>{status}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>

      {/* Staff Assignments */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>Staff Assignments</Typography>
        <Grid container spacing={2}>
          {staff.map((s) => {
            const currentAssignment = assignments.find((a: any) => a.doctor_id === s.id);
            const patientName = patients.find((p) => p.id === currentAssignment?.patient_id)?.name || "None";
            return (
              <Grid item xs={12} sm={6} md={4} key={s.id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">{s.name}</Typography>
                    <Typography>Specialization: {s.specialization}</Typography>
                    <Typography>Current Patient: {patientName}</Typography>
                    <Typography>Wait Time: {currentAssignment?.wait_time_minutes || 0} min</Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Summary Box */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1">{summary}</Typography>
      </Paper>
    </Container>
  );
}
