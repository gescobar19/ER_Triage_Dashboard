import os
import json
import boto3
from botocore.exceptions import ClientError, BotoCoreError
from datetime import datetime
import uuid

# Environment variables
REGION   = os.environ.get("AWS_REGION", "us-east-1")
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0")
DDB_TABLE = os.environ.get("DDB_TABLE", "ER_Triage")

# AWS clients
bedrock_client = boto3.client("bedrock-runtime", region_name=REGION)
ddb_client = boto3.client("dynamodb", region_name=REGION)

def build_prompt(patients, staff):
    return f"""
You are an Emergency Room (ER) scheduling assistant.
Your job:
- Triage patients, assign available staff, estimate wait times.
- Prioritize patients: critical > medium > low.
- Break ties by earlier arrival_time.
- Balance staff load evenly.
- All times in minutes; arrival_time is ISO 8601.

INPUT DATA:
Patients:
{json.dumps(patients, indent=2)}

Staff:
{json.dumps(staff, indent=2)}

OUTPUT FORMAT:
Return ONLY valid JSON:
{{
  "triage_order": ["P1","P2","P3"],
  "assignments": [
    {{ "patient_id": "P1", "doctor_id": "D2", "wait_time_minutes": 0 }}
  ],
  "summary": "Short 1-2 sentence summary"
}}
"""

def save_to_dynamodb(request_id, patients, staff, triage_result):
    try:
        ddb_client.put_item(
            TableName=DDB_TABLE,
            Item={
                "request_id": {"S": request_id},
                "timestamp": {"S": datetime.utcnow().isoformat()},
                "input_patients": {"S": json.dumps(patients)},
                "input_staff": {"S": json.dumps(staff)},
                "triage_result": {"S": json.dumps(triage_result)}
            }
        )
    except ClientError as e:
        print("DynamoDB error:", e)

def lambda_handler(event, context):
    request_id = str(uuid.uuid4())

    try:
        body = json.loads(event.get("body", "{}"))
        patients = body.get("patients", [])
        staff = body.get("staff", [])

        if not patients or not staff:
            return respond(400, {"error": "Missing 'patients' or 'staff' in request body"})

        prompt = build_prompt(patients, staff)

        bedrock_body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 400,
            "temperature": 0.2,
            "messages": [{"role": "user", "content": prompt}]
        })

        resp = bedrock_client.invoke_model(modelId=MODEL_ID, body=bedrock_body)
        raw_text = json.loads(resp["body"].read())["content"][0]["text"]

        # Parse Bedrock JSON
        try:
            triage_result = json.loads(raw_text)
        except json.JSONDecodeError:
            triage_result = {"error": "Model returned invalid JSON", "raw_output": raw_text}

        # Save request to DynamoDB
        save_to_dynamodb(request_id, patients, staff, triage_result)

        return respond(200, {"request_id": request_id, "result": triage_result})

    except (ClientError, BotoCoreError) as e:
        return respond(500, {"error": f"AWS error: {str(e)}"})
    except Exception as e:
        return respond(500, {"error": str(e)})

def respond(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body)
    }
