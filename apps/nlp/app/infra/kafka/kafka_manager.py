import asyncio
from functools import lru_cache
import json
from typing import Dict, List
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from fastapi.encoders import jsonable_encoder
from app.core import get_config, get_logger

logger = get_logger()


class KafkaManager:
    def __init__(self):
        self.producer = None
        self.consumers: Dict[str, Dict] = {}
        self.consumer_tasks: Dict[str, asyncio.Task] = {}
        self._shutdown_event = asyncio.Event()
        self._running = True

    # --- Producer ---
    async def start_producer(self):
        """Start producer with timeout"""
        config = get_config()
        self.producer = AIOKafkaProducer(
            bootstrap_servers=config.kafka.broker,
            client_id=config.kafka.client_id,
            request_timeout_ms=30000,  # 30 seconds
            retry_backoff_ms=100,
            max_request_size=1000000,  # 1MB
        )

        try:
            await asyncio.wait_for(self.producer.start(), timeout=30.0)
            logger.info("Kafka producer started successfully")
        except asyncio.TimeoutError:
            logger.error("Timeout starting Kafka producer")
            raise
        except Exception as e:
            logger.error(f"Error starting Kafka producer: {e}")
            raise

    async def stop_producer(self):
        """Stop producer with timeout"""
        if self.producer:
            try:
                await asyncio.wait_for(self.producer.stop(), timeout=10.0)
                logger.info("Kafka producer stopped successfully")
            except asyncio.TimeoutError:
                logger.warning("Timeout stopping Kafka producer")
            except Exception as e:
                logger.error(f"Error stopping Kafka producer: {e}")
            finally:
                self.producer = None

    async def send_message(self, topic: str, message: Dict, retry: int = 3):
        """Send message with retry logic"""
        if not self.producer:
            raise RuntimeError("Producer not started")

        # Ensure message is JSON-serializable
        safe_message = jsonable_encoder(message)
        payload = json.dumps(safe_message).encode("utf-8")
        for attempt in range(retry):
            try:
                await asyncio.wait_for(
                    self.producer.send_and_wait(topic, payload), timeout=10.0
                )
                return
            except asyncio.TimeoutError:
                logger.warning(f"[Kafka Send] Timeout attempt {attempt + 1}/{retry}")
            except Exception as e:
                logger.warning(
                    f"[Kafka Send] Attempt {attempt + 1}/{retry} failed: {e}"
                )
                if attempt < retry - 1:  # Don't sleep on last attempt
                    await asyncio.sleep(min(2**attempt, 5))  # Exponential backoff
        raise RuntimeError("Kafka send failed after retries")

    # --- Consumer ---
    async def register_consumer(
        self, name: str, group_id: str, topics: List, handler_func
    ):
        """Register new consumer""" 
        config = get_config()
        consumer = AIOKafkaConsumer(
            *topics,
            bootstrap_servers=config.kafka.broker,
            group_id=group_id,
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            auto_commit_interval_ms=1000,
            consumer_timeout_ms=1000,  # 1 second timeout
            request_timeout_ms=30000,  # 30 seconds
            session_timeout_ms=30000,  # 30 seconds
            heartbeat_interval_ms=3000,  # 3 seconds
        )

        self.consumers[name] = {
            "consumer": consumer,
            "handler": handler_func,
            "topics": topics,
            "group_id": group_id,
        }
        logger.info(f"Consumer {name} registered for topics: {topics}")

    async def start_consumer(self, name: str):
        """Start a specific consumer with timeout"""
        if name not in self.consumers:
            raise ValueError(f"Consumer {name} not registered")

        consumer_info = self.consumers[name]
        consumer = consumer_info["consumer"]
        handler = consumer_info["handler"]

        try:
            await asyncio.wait_for(consumer.start(), timeout=30.0)
            logger.info(f"Consumer {name} started successfully")
        except asyncio.TimeoutError:
            logger.error(f"Timeout starting consumer {name}")
            raise
        except Exception as e:
            logger.error(f"Error starting consumer {name}: {e}")
            raise

        # Create task to run consumer
        task = asyncio.create_task(
            self._run_consumer(name, consumer, handler), name=f"consumer-{name}"
        )
        self.consumer_tasks[name] = task

        return task

    async def start_all_consumers(self):
        """Start all registered consumers"""
        tasks = []
        for name in self.consumers:
            try:
                task = await self.start_consumer(name)
                tasks.append(task)
            except Exception as e:
                logger.error(f"Failed to start consumer {name}: {e}")
                # Continue starting other consumers
                continue

        logger.info(f"Started {len(tasks)} consumers successfully")
        return tasks

    async def stop_consumer(self, name: str):
        """Stop a specific consumer with timeout"""
        if name in self.consumer_tasks:
            task = self.consumer_tasks[name]

            # Cancel the task
            if not task.done():
                task.cancel()

                try:
                    await asyncio.wait_for(task, timeout=10.0)
                except asyncio.TimeoutError:
                    logger.warning(f"Consumer {name} task didn't finish within timeout")
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    logger.error(f"Error stopping consumer {name} task: {e}")

            # Stop the consumer
            if name in self.consumers:
                consumer = self.consumers[name]["consumer"]
                try:
                    await asyncio.wait_for(consumer.stop(), timeout=10.0)
                    logger.info(f"Consumer {name} stopped successfully")
                except asyncio.TimeoutError:
                    logger.warning(f"Timeout stopping consumer {name}")
                except Exception as e:
                    logger.error(f"Error stopping consumer {name}: {e}")

            # Remove from tracking
            del self.consumer_tasks[name]

    async def stop_all_consumers(self):
        """Stop all consumers with timeout"""
        self._running = False
        self._shutdown_event.set()

        logger.info(f"Stopping {len(self.consumer_tasks)} consumers...")

        # Cancel all tasks first
        tasks_to_cancel = list(self.consumer_tasks.values())
        for task in tasks_to_cancel:
            if not task.done():
                task.cancel()

        # Wait for tasks to finish
        if tasks_to_cancel:
            try:
                await asyncio.wait_for(
                    asyncio.gather(*tasks_to_cancel, return_exceptions=True),
                    timeout=15.0,
                )
            except asyncio.TimeoutError:
                logger.warning("Some consumer tasks didn't finish within timeout")

        # Stop all consumers
        stop_tasks = []
        for name in list(self.consumers.keys()):
            if name in self.consumers:
                consumer = self.consumers[name]["consumer"]
                stop_tasks.append(self._stop_consumer_safe(name, consumer))

        if stop_tasks:
            await asyncio.gather(*stop_tasks, return_exceptions=True)

        # Clear tracking
        self.consumer_tasks.clear()
        logger.info("All consumers stopped")

    async def _stop_consumer_safe(self, name: str, consumer):
        """Safely stop a consumer"""
        try:
            await asyncio.wait_for(consumer.stop(), timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning(f"Timeout stopping consumer {name}")
        except Exception as e:
            logger.error(f"Error stopping consumer {name}: {e}")

    async def _run_consumer(self, name: str, consumer, handler_func):
        """Run consumer logic with proper error handling"""
        try:
            logger.info(f"Consumer {name} started consuming...")

            async for msg in consumer:
                # Check if shutdown is requested
                if self._shutdown_event.is_set() or not self._running:
                    logger.info(f"Consumer {name} stopping due to shutdown signal")
                    break

                try:
                    if not msg.value:
                        continue

                    # Process message with timeout
                    data = json.loads(msg.value.decode("utf-8"))

                    # Run handler with timeout
                    await asyncio.wait_for(
                        handler_func(data), timeout=300.0  # 5 minutes max per message
                    )

                    logger.debug(f"Consumer {name} processed message successfully")

                except json.JSONDecodeError:
                    logger.error(f"Consumer {name}: Invalid JSON message")
                    await self._send_to_dead_letter(name, msg, "Invalid JSON")

                except asyncio.TimeoutError:
                    logger.error(f"Consumer {name}: Handler timeout")
                    await self._send_to_dead_letter(name, msg, "Handler timeout")

                except asyncio.CancelledError:
                    logger.info(f"Consumer {name} cancelled")
                    raise

                except Exception as e:
                    logger.error(f"Consumer {name}: Error processing message: {e}")
                    await self._send_to_dead_letter(name, msg, str(e))

        except asyncio.CancelledError:
            logger.info(f"Consumer {name} was cancelled")
            raise
        except Exception as e:
            logger.error(f"Consumer {name}: Unexpected error: {e}")
        finally:
            logger.info(f"Consumer {name} finished")

    async def _send_to_dead_letter(self, consumer_name: str, msg, error_msg: str):
        """Send failed message to dead letter topic"""
        try:
            if not self.producer:
                logger.warning(
                    f"Producer not available for dead letter from {consumer_name}"
                )
                return

            raw_value = msg.value.decode("utf-8") if msg.value else ""
            dead_letter_message = {
                "consumer_name": consumer_name,
                "original_data": raw_value,
                "error": error_msg,
                "topic": getattr(msg, "topic", "unknown"),
                "offset": getattr(msg, "offset", -1),
                "partition": getattr(msg, "partition", -1),
                "timestamp": getattr(msg, "timestamp", 0),
            }

            await asyncio.wait_for(
                self.send_message("nlp.dead_letter", dead_letter_message), timeout=5.0
            )
            logger.info(f"Sent message to dead letter topic from {consumer_name}")

        except Exception as send_err:
            logger.error(
                f"Failed to send to dead_letter_topic from {consumer_name}: {send_err}"
            )

    async def health_check(self):
        """Health check for Kafka connection"""
        try:
            if not self.producer:
                return {"status": "unhealthy", "reason": "Producer not started"}

            # Check producer health by sending a simple test
            try:
                # Try to get cluster metadata
                cluster = self.producer.client.cluster
                if cluster and hasattr(cluster, "brokers"):
                    # Check if brokers is a method or property
                    brokers = (
                        cluster.brokers()
                        if callable(cluster.brokers)
                        else cluster.brokers
                    )
                    broker_count = len(brokers) if brokers else 0
                    producer_healthy = broker_count > 0
                else:
                    # Alternative: try a simple operation
                    await asyncio.wait_for(
                        self.producer.client.bootstrap(), timeout=5.0
                    )
                    cluster = self.producer.client.cluster
                    if cluster and hasattr(cluster, "brokers"):
                        brokers = (
                            cluster.brokers()
                            if callable(cluster.brokers)
                            else cluster.brokers
                        )
                        broker_count = len(brokers) if brokers else 0
                    else:
                        broker_count = 0
                    producer_healthy = broker_count > 0

            except Exception as e:
                logger.warning(f"Producer health check failed: {e}")
                producer_healthy = False
                broker_count = 0

            # Check consumers
            running_consumers = len(
                [t for t in self.consumer_tasks.values() if not t.done()]
            )
            failed_consumers = [
                name
                for name, task in self.consumer_tasks.items()
                if task.done() and task.exception()
            ]

            # Overall health status
            overall_healthy = (
                producer_healthy
                and running_consumers == len(self.consumers)
                and len(failed_consumers) == 0
            )

            return {
                "status": "healthy" if overall_healthy else "degraded",
                "producer": {
                    "status": "running" if producer_healthy else "unhealthy",
                    "broker_count": broker_count,
                },
                "consumers": {
                    "total": len(self.consumers),
                    "running": running_consumers,
                    "failed": failed_consumers,
                    "tasks": list(self.consumer_tasks.keys()),
                },
                "details": {
                    "registered_consumers": list(self.consumers.keys()),
                    "running_tasks": [
                        name
                        for name, task in self.consumer_tasks.items()
                        if not task.done()
                    ],
                },
            }

        except Exception as e:
            return {"status": "unhealthy", "reason": str(e)}


kafka_manager = KafkaManager()


# For DI
@lru_cache()
def get_kafka():
    return kafka_manager
