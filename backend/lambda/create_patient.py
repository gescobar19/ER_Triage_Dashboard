import json
import boto3
import os
from datetime import datetime

# DynamoDB table
dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("PATIENT_TABLE")  # make sure to set this in Lambda config
table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    try:
        # Parse request body
        body = json.loads(event.get("body", "{}"))
        required_fields = ["id", "name", "severity", "treatment_duration"]

        # Validate input
        for field in required_fields:
            if field not in body:
                return respond(400, {"error": f"Missing field: {field}"})

        # Check severity
        if body["severity"] not in ["critical", "medium", "low"]:
            return respond(400, {"error": "Invalid severity. Must be 'critical', 'medium', or 'low'"})

        # Prepare patient item
        patient = {
            "id": body["id"],
            "name": body["name"],
            "severity": body["severity"],
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
            "Access-Control-Allow-Origin": "*",          # CORS
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
            "Access-Control-Allow-Headers": "Content-Type"
        },
        "body": json.dumps(body)
    }
