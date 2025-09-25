const API_URL = process.env.REACT_APP_API_URL;

export async function postTriage(patients: any[], staff: any[]) {
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
