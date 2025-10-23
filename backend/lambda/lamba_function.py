import os
import json
import boto3
from datetime import datetime
import uuid

# DynamoDB table and AWS clients
REGION = os.environ.get("AWS_REGION", "us-east-1")
DDB_TABLE = os.environ.get("DDB_TABLE", "ER_Triage")
bedrock_model_id = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0")

ddb_client = boto3.client("dynamodb", region_name=REGION)
bedrock_client = boto3.client("bedrock-runtime", region_name=REGION)

def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body", "{}"))
        patients = body.get("patients", [])
        staff = body.get("staff", [])

        if not patients or not staff:
            return respond(400, {"error": "Missing 'patients' or 'staff' in request body"})

        # Ensure every patient has required fields
        for p in patients:
            if "id" not in p or "name" not in p or "symptoms" not in p:
                return respond(400, {"error": f"Patient missing required fields: {p}"})
            # Optionally generate severity if missing
            if "severity" not in p or not p["severity"]:
                p["severity"] = determine_severity(p["symptoms"])

        # Build prompt for Bedrock model
        prompt = build_prompt(patients, staff)

        response = bedrock_client.invoke_model(
            modelId=bedrock_model_id,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 400,
                "temperature": 0.2,
                "messages": [{"role": "user", "content": prompt}]
            })
        )

        raw_text = json.loads(response["body"].read())["content"][0]["text"]

        try:
            triage_result = json.loads(raw_text)
        except json.JSONDecodeError:
            triage_result = {"error": "Model returned invalid JSON", "raw_output": raw_text}

        # Save request to DynamoDB
        save_to_dynamodb(patients, staff, triage_result)

        return respond(200, {"result": triage_result})

    except Exception as e:
        return respond(500, {"error": str(e)})


def determine_severity(symptoms: str) -> str:
    symptoms = symptoms.lower()
    if any(x in symptoms for x in ["chest pain", "shortness of breath", "head injury", "severe"]):
        return "critical"
    elif any(x in symptoms for x in ["fever", "abdominal pain", "persistent cough"]):
        return "medium"
    else:
        return "low"


def build_prompt(patients, staff):
    return f"""
You are an ER triage assistant.
Patients:
{json.dumps(patients, indent=2)}
Staff:
{json.dumps(staff, indent=2)}
Return JSON:
{{
  "triage_order": ["P1","P2","P3"],
  "assignments": [
    {{ "patient_id": "P1", "doctor_id": "D2", "wait_time_minutes": 0 }}
  ],
  "summary": "Short summary"
}}
"""


def save_to_dynamodb(patients, staff, triage_result):
    try:
        ddb_client.put_item(
            TableName=DDB_TABLE,
            Item={
                "request_id": {"S": str(uuid.uuid4())},
                "timestamp": {"S": datetime.utcnow().isoformat()},
                "input_patients": {"S": json.dumps(patients)},
                "input_staff": {"S": json.dumps(staff)},
                "triage_result": {"S": json.dumps(triage_result)}
            }
        )
    except Exception as e:
        print("DynamoDB save error:", e)


def respond(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body)
    }
