import asyncio
from app.core import get_logger
from app.schemas.event import EmailSendEvent

logger = get_logger()


async def send_email(data: dict):
    try:
        event = EmailSendEvent(**data)
    except Exception as e:
        logger.error(f"[Kafka] Invalid email event: {e}")
        return
    # Fake send mail: chỉ in ra console
    await asyncio.sleep(0.1)  # Giả lập delay gửi mail
    logger.info(
        f"[FAKE EMAIL] To: {event.to} | Subject: {event.subject} | HTML: {event.html} | Text: {event.text}"
    )
    return True
