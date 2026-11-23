from datetime import datetime, timezone, timedelta
from prefect import flow, task, get_run_logger
from common import dynamodb_resource


@task
def audit_sagas(env: str) -> dict:
    logger = get_run_logger()
    table_name = f"aegisvolt-sagas-{env}"
    table = dynamodb_resource().Table(table_name)
    response = table.scan(FilterExpression="sk = :meta", ExpressionAttributeValues={":meta": "META"})
    items = response.get("Items", [])
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    orphaned = []
    compensated = []

    for item in items:
        status = item.get("status")
        updated = datetime.fromisoformat(str(item.get("updated_at", "")).replace("Z", "+00:00"))
        if status in {"STARTED", "RESERVED", "CHARGED", "COMPENSATING"} and updated < cutoff:
            orphaned.append(item)
        if status == "COMPENSATED":
            compensated.append(item)

    result = {"env": env, "orphaned": len(orphaned), "compensated": len(compensated), "orphaned_ids": [str(item.get("pk", "")) for item in orphaned]}
    logger.info("Saga audit completed: %s", result)
    return result


@flow(name="aegisvolt-saga-audit")
def saga_audit():
    return [audit_sagas(env) for env in ("dev", "test", "prod")]


if __name__ == "__main__":
    saga_audit()
