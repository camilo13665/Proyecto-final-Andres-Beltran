from prefect import flow, task, get_run_logger
from common import dynamodb_resource


@task
def collect_metrics(env: str) -> dict:
    logger = get_run_logger()
    table = dynamodb_resource().Table(f"aegisvolt-sagas-{env}")
    items = table.scan(FilterExpression="sk = :meta", ExpressionAttributeValues={":meta": "META"}).get("Items", [])
    counts = {}
    for item in items:
        status = str(item.get("status", "UNKNOWN"))
        counts[status] = counts.get(status, 0) + 1
    result = {"env": env, "total_sagas": len(items), "status_counts": counts}
    logger.info("AegisVolt metrics: %s", result)
    return result


@flow(name="aegisvolt-metrics-report")
def metrics_report():
    return [collect_metrics(env) for env in ("dev", "test", "prod")]


if __name__ == "__main__":
    metrics_report()
