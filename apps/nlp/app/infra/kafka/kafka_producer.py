from app.infra.kafka.kafka_manager import kafka_manager


async def send_user_created_event(user: dict):
    await kafka_manager.send_message("user.created", user)
