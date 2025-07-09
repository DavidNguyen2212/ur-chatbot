import sys
from loguru import logger
from app.core.config import AppConfig

def setup_logger(config: AppConfig):
    logger.remove()  # Remove default handler (stderr)

    logger.add(
        config.logger.log_file,
        level=config.logger.level,
        format=config.logger.format,
        rotation=config.logger.rotation,
        retention=config.logger.retention,
        compression=config.logger.compression,
        serialize=config.logger.serialize,
        enqueue=True  # good for multiprocessing / async
    )

    # Log to stdout (parallel to file)
    logger.add(
        sink=sys.stdout,
        level=config.logger.level,
        format=config.logger.format,
        serialize=False,
        enqueue=True,
    )

def get_logger():
    return logger