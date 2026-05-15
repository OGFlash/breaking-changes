from __future__ import annotations
import aioboto3
import structlog
from app.config import settings

logger = structlog.get_logger()
_session = aioboto3.Session()


async def send_contact_email(name: str, email: str, subject: str, message: str) -> None:
    body = f"""New contact form submission

From: {name} <{email}>
Subject: {subject}

{message}
"""
    async with _session.client("ses", region_name=settings.AWS_REGION) as ses:
        await ses.send_email(
            Source=settings.SES_SENDER_EMAIL,
            Destination={"ToAddresses": [settings.ADMIN_EMAIL]},
            Message={
                "Subject": {"Data": f"[Breaking Changes] {subject}"},
                "Body": {"Text": {"Data": body}},
            },
            ReplyToAddresses=[email],
        )
    logger.info("contact_email_sent", from_email=email)
