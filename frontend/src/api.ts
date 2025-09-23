export async function postTriage(patients: any[], staff: any[]) {
  const resp = await fetch(
    "https://3gusgpx6i0.execute-api.us-east-1.amazonaws.com/dev/triage", // <-- your Lambda Invoke URL
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patients, staff }),
    }
  );
  if (!resp.ok) throw new Error("API error");
  return resp.json();
}
