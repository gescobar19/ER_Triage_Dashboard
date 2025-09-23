import os
import json
import boto3
from botocore.exceptions import ClientError

# Configure your region and model ID
REGION   = os.environ.get("AWS_REGION", "us-east-1")
MODEL_ID = "anthropic.claude-3-sonnet-20240229-v1:0"

client = boto3.client("bedrock-runtime", region_name=REGION)

def build_prompt(patients, staff):
    """
    Build the ER scheduling prompt.
    patients and staff are Python lists of dicts.
    """
    return f"""
You are an Emergency Room (ER) scheduling assistant.

Your job:
- Triage patients, assign available staff, and estimate wait times.
- Always prioritize patients by severity: critical > medium > low.
- For equal severity, break ties by earlier arrival_time.
- Balance staff load evenly when possible.
- All times are minutes and arrival_time is ISO 8601.

INPUT DATA:
Patients:
{json.dumps(patients, indent=2)}

Staff:
{json.dumps(staff, indent=2)}

OUTPUT FORMAT:
Output ONLY valid JSON, with this schema:
{{
  "triage_order": ["P1","P2","P3"],
  "assignments": [
    {{ "patient_id": "P1", "doctor_id": "D2", "wait_time_minutes": 0 }}
  ],
  "summary": "Short human-readable summary (1-2 sentences)"
}}

If no valid assignment is possible, set doctor_id to null and explain in summary.
"""

def lambda_handler(event, context):
    """
    Lambda entry point.
    Expects an API Gateway (HTTP API) event with JSON body:
    {
      "patients": [...],
      "staff": [...]
    }
    """
    try:
        body = json.loads(event.get("body", "{}"))
        patients = body.get("patients", [])
        staff    = body.get("staff", [])

        if not patients or not staff:
            return _response(400, {"error": "Missing 'patients' or 'staff' in request body"})

        prompt = build_prompt(patients, staff)

        bedrock_body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 400,
            "temperature": 0.2,
            "messages": [
                {"role": "user", "content": prompt}
            ]
        })

        resp = client.invoke_model(
            modelId=MODEL_ID,
            body=bedrock_body
        )

        raw = json.loads(resp['body'].read())
        model_text = raw["content"][0]["text"]

        # Parse JSON produced by the model
        try:
            parsed = json.loads(model_text)
        except json.JSONDecodeError:
            return _response(502, {
                "error": "Model returned non-JSON response",
                "raw_output": model_text
            })

        return _response(200, parsed)

    except ClientError as e:
        return _response(500, {"error": f"AWS error: {str(e)}"})
    except Exception as e:
        return _response(500, {"error": str(e)})

def _response(status, body):
    """Helper to format API Gateway compatible JSON response."""
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"   # allow CORS if needed
        },
        "body": json.dumps(body)
    }
