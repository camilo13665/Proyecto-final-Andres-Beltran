from prefect import flow, task, get_run_logger
import httpx


@task(retries=2, retry_delay_seconds=2)
def check_gateway(env: str, url: str) -> dict:
    logger = get_run_logger()
    try:
        response = httpx.get(f"{url}/health", timeout=5)
        response.raise_for_status()
        result = {"env": env, "status": "ok", "url": url}
        logger.info("Health check passed", extra=result)
        return result
    except Exception as exc:
        logger.error("Health check failed: %s", exc)
        return {"env": env, "status": "failed", "url": url, "error": str(exc)}


@flow(name="aegisvolt-health-check")
def health_check():
    logger = get_run_logger()
    endpoints = {
        "dev": "http://localhost:4000",
        "test": "http://localhost:4000",
        "prod": "http://localhost:4000",
    }
    results = [check_gateway(env, url) for env, url in endpoints.items()]
    logger.info("Health check result: %s", results)
    return results


if __name__ == "__main__":
    health_check()
