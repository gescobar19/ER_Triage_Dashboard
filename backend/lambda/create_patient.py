import json
import boto3
import os
from datetime import datetime

# DynamoDB table
dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("PATIENT_TABLE")
table = dynamodb.Table(TABLE_NAME)

# Simple symptom-based severity determination
def determine_severity(symptoms: str) -> str:
    symptoms = symptoms.lower()
    if any(x in symptoms for x in ["chest pain", "shortness of breath", "head injury"]):
        return "critical"
    elif any(x in symptoms for x in ["fever", "persistent cough", "abdominal pain"]):
        return "medium"
    else:
        return "low"

def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body", "{}"))
        required_fields = ["id", "name", "symptoms", "treatment_duration"]

        # Validate input
        for field in required_fields:
            if field not in body:
                return respond(400, {"error": f"Missing field: {field}"})

        # Determine severity automatically
        severity = determine_severity(body["symptoms"])

        # Prepare patient item
        patient = {
            "id": body["id"],
            "name": body["name"],
            "symptoms": body["symptoms"],
            "severity": severity,
            "arrival_time": body.get("arrival_time", datetime.utcnow().isoformat()),
            "treatment_duration": int(body["treatment_duration"])
        }

        # Save to DynamoDB
        table.put_item(Item=patient)

        return respond(200, {"message": "Patient added successfully", "patient": patient})

    except Exception as e:
        print("Error:", str(e))
        return respond(500, {"error": str(e)})

def respond(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
            "Access-Control-Allow-Headers": "Content-Type"
        },
        "body": json.dumps(body)
    }
