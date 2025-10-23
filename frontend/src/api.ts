const API_URL = process.env.REACT_APP_API_URL;
console.log("API URL:", API_URL); // Optional: for debugging

export interface Patient {
  id: string;
  name: string;
  symptoms: string;
  severity?: "critical" | "medium" | "low"; // optional, backend calculates
  arrival_time: string;
  treatment_duration: number;
}

export async function postTriage(patients: Patient[], staff: any[]) {
  const res = await fetch(`${API_URL}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patients, staff })
  });
  if (!res.ok) throw new Error("API error");
  return await res.json();
}

export async function addPatient(patient: Patient) {
  const res = await fetch(`${API_URL}/patient`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patient),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to add patient: ${errorBody}`);
  }

  return res.json();
}
