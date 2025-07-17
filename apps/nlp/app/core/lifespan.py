import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core import get_logger
from app.core.config import get_config
from app.infra.kafka.kafka_manager import kafka_manager
from app.consumers.registry import CONSUMER_REGISTRY
from app.services.v1.user_service_client import setup_user_service

logger = get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan with proper Kafka management"""

    # Startup
    logger.info("🚀 Starting application...")
    startup_success = False
    config = get_config()
    try:
        # 1. Start producer first
        logger.info("📡 Starting Kafka producer...")
        await asyncio.wait_for(kafka_manager.start_producer(), timeout=30.0)
        logger.info("✅ Kafka producer started")

        # 2. Register consumers
        logger.info("📋 Registering consumers...")

        # Register all consumers
        for csm in CONSUMER_REGISTRY.values():
            await kafka_manager.register_consumer(
                name=csm.name.value,
                group_id=csm.group_id,
                topics=csm.topics,
                handler_func=csm.handler_func
            )
            logger.info(f"✅ Registered consumer: {csm.name.value}")

        # 3. Start all consumers
        # logger.info("🔄 Starting all consumers...")
        await asyncio.wait_for(kafka_manager.start_all_consumers(), timeout=45.0)
        logger.info("✅ All consumers started successfully")

        # 4. Health check
        health = await kafka_manager.health_check()
        logger.info(f"💊 Kafka health: {health}")

        setup_user_service(config.USER_SERVICE_HOST, config.USER_SERVICE_PORT)

        startup_success = True
        logger.info("🎉 Application startup completed successfully!")

        yield

    except asyncio.TimeoutError:
        logger.error("⏰ Timeout during application startup")
        raise
    except asyncio.CancelledError:
        logger.warning("🛑 Application shutdown interrupted (CancelledError)")
        raise
    except Exception as e:
        logger.error(f"💥 Error during startup: {e}")
        raise
    finally:
        # Shutdown
        logger.info("🛑 Shutting down application...")

        # Only attempt cleanup if startup was successful
        if startup_success:
            # 1. Stop consumers first
            logger.info("🔄 Stopping consumers...")
            try:
                await asyncio.wait_for(kafka_manager.stop_all_consumers(), timeout=30.0)
                logger.info("✅ All consumers stopped")
            except asyncio.TimeoutError:
                logger.warning("⏰ Timeout stopping consumers")
            except Exception as e:
                logger.error(f"💥 Error stopping consumers: {e}")

            # 2. Stop producer
            logger.info("📡 Stopping producer...")
            try:
                await asyncio.wait_for(kafka_manager.stop_producer(), timeout=15.0)
                logger.info("✅ Producer stopped")
            except asyncio.TimeoutError:
                logger.warning("⏰ Timeout stopping producer")
            except Exception as e:
                logger.error(f"💥 Error stopping producer: {e}")

        # 3. Cancel any remaining tasks
        current_task = asyncio.current_task()
        pending_tasks = [
            task
            for task in asyncio.all_tasks()
            if task is not current_task and not task.done()
            # and not any(kw in str(task.get_coro()) for kw in ["uvicorn", "watchfiles", "signal_handlers"])
        ]

        if pending_tasks:
            logger.info(f"🧹 Cancelling {len(pending_tasks)} remaining tasks...")
            for task in pending_tasks:
                task.cancel()

            try:
                await asyncio.wait_for(
                    asyncio.gather(*pending_tasks, return_exceptions=True), timeout=10.0
                )
                logger.info("✅ All tasks cancelled")
            except asyncio.TimeoutError:
                logger.warning("⏰ Some tasks didn't cancel in time")

        logger.info("🏁 Application shutdown completed")


# Add health check endpoint
# async def kafka_health():
#     """Health check endpoint for Kafka"""
#     return await kafka_manager.health_check()
