import os
import boto3


def aws_session():
    return boto3.Session(
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "test"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "test"),
        region_name=os.getenv("AWS_REGION", "us-east-1"),
    )


def dynamodb_resource():
    return aws_session().resource(
        "dynamodb",
        endpoint_url=os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566"),
    )


def gateway_url(env: str) -> str:
    return os.getenv(f"GATEWAY_URL_{env.upper()}", f"http://localhost:4000")
