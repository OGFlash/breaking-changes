import asyncio
import json
from mangum import Mangum
from app.main import app

_mangum = Mangum(app, lifespan="off")


def handler(event, context):
    if "ai_job" in event:
        from app.routers.admin_ai_writer import run_job
        job = event["ai_job"]
        asyncio.run(run_job(job["job_type"], job["job_id"], job["params"]))
        # asyncio.run() closes the event loop; restore one so the next warm
        # invocation (Mangum) can call asyncio.get_event_loop() successfully.
        asyncio.set_event_loop(asyncio.new_event_loop())
        return {"status": "ok"}
    return _mangum(event, context)

