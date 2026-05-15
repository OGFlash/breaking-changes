from __future__ import annotations
import aioboto3
import structlog
from datetime import date, timedelta
from app.config import settings

logger = structlog.get_logger()
_session = aioboto3.Session()


def _client():
    return _session.client("dynamodb", region_name=settings.AWS_REGION)


def _week_start() -> str:
    """ISO date string for current week's Monday."""
    today = date.today()
    return (today - timedelta(days=today.weekday())).isoformat()


async def increment_view(slug: str) -> int:
    """Increment views with date-aware resets for today/week counters."""
    today_str = date.today().isoformat()
    week_str = _week_start()

    async with _client() as ddb:
        # Fetch current record to check stored dates
        resp = await ddb.get_item(
            TableName=settings.DYNAMODB_TABLE,
            Key={"slug": {"S": slug}},
        )
        item = resp.get("Item", {})
        stored_today = item.get("today_date", {}).get("S", "")
        stored_week = item.get("week_start", {}).get("S", "")

        # Build conditional resets
        resets: dict = {}
        if stored_today != today_str:
            resets["views_today"] = 1
            resets["today_date"] = today_str
        if stored_week != week_str:
            resets["views_week"] = 1
            resets["week_start"] = week_str

        if resets:
            # Need to reset — use explicit SET + ADD
            set_parts = []
            add_parts = ["total_views :one"]
            expr_names: dict = {}
            expr_vals: dict = {":one": {"N": "1"}}

            if "views_today" in resets:
                set_parts += ["views_today = :one", "today_date = :today"]
                expr_vals[":today"] = {"S": today_str}
            else:
                add_parts.append("views_today :one")

            if "views_week" in resets:
                set_parts += ["views_week = :one", "week_start = :wk"]
                expr_vals[":wk"] = {"S": week_str}
            else:
                add_parts.append("views_week :one")

            update_expr = f"SET {', '.join(set_parts)} ADD {', '.join(add_parts)}"
            result = await ddb.update_item(
                TableName=settings.DYNAMODB_TABLE,
                Key={"slug": {"S": slug}},
                UpdateExpression=update_expr,
                ExpressionAttributeValues=expr_vals,
                ReturnValues="UPDATED_NEW",
            )
        else:
            result = await ddb.update_item(
                TableName=settings.DYNAMODB_TABLE,
                Key={"slug": {"S": slug}},
                UpdateExpression="ADD total_views :one, views_today :one, views_week :one",
                ExpressionAttributeValues={":one": {"N": "1"}},
                ReturnValues="UPDATED_NEW",
            )

        return_views = int(result["Attributes"].get("total_views", {}).get("N", 0))
        await _record_daily_view(ddb, today_str)
        return return_views


async def _record_daily_view(ddb: any, today_str: str) -> None:
    """Increment the global daily view counter for analytic charts."""
    try:
        await ddb.update_item(
            TableName=settings.DYNAMODB_TABLE,
            Key={"slug": {"S": f"_daily:{today_str}"}},
            UpdateExpression="ADD total_views :one",
            ExpressionAttributeValues={":one": {"N": "1"}},
        )
    except Exception:
        pass  # best-effort


async def get_daily_chart(days: int = 30) -> list[dict]:
    today = date.today()
    async with _client() as ddb:
        result = []
        for i in range(days):
            d = today - timedelta(days=days - 1 - i)
            date_str = d.isoformat()
            try:
                resp = await ddb.get_item(
                    TableName=settings.DYNAMODB_TABLE,
                    Key={"slug": {"S": f"_daily:{date_str}"}},
                )
                views = int(resp.get("Item", {}).get("total_views", {}).get("N", 0))
            except Exception:
                views = 0
            result.append({
                "date": d.strftime("%b %-d"),
                "views": views,
            })
    return result


async def get_views(slug: str) -> dict:
    async with _client() as ddb:
        resp = await ddb.get_item(
            TableName=settings.DYNAMODB_TABLE,
            Key={"slug": {"S": slug}},
        )
        item = resp.get("Item", {})
        return {
            "slug": slug,
            "total_views": int(item.get("total_views", {}).get("N", 0)),
            "views_today": int(item.get("views_today", {}).get("N", 0)),
            "views_week": int(item.get("views_week", {}).get("N", 0)),
        }


async def get_trending(limit: int = 5) -> list[dict]:
    async with _client() as ddb:
        resp = await ddb.scan(
            TableName=settings.DYNAMODB_TABLE,
            ProjectionExpression="slug, total_views, views_today, views_week",
        )
        items = resp.get("Items", [])
        parsed = [
            {
                "slug": i["slug"]["S"],
                "total_views": int(i.get("total_views", {}).get("N", 0)),
                "views_today": int(i.get("views_today", {}).get("N", 0)),
                "views_week": int(i.get("views_week", {}).get("N", 0)),
            }
            for i in items
            if not i["slug"]["S"].startswith("_daily:")
        ]
        return sorted(parsed, key=lambda x: x["views_today"], reverse=True)[:limit]


async def scan_all_views() -> list[dict]:
    async with _client() as ddb:
        resp = await ddb.scan(
            TableName=settings.DYNAMODB_TABLE,
            ProjectionExpression="slug, total_views, views_today, views_week",
        )
        items = resp.get("Items", [])
        return [
            {
                "slug": i["slug"]["S"],
                "total_views": int(i.get("total_views", {}).get("N", 0)),
                "views_today": int(i.get("views_today", {}).get("N", 0)),
                "views_week": int(i.get("views_week", {}).get("N", 0)),
            }
            for i in items
            if not i["slug"]["S"].startswith("_daily:")
        ]
