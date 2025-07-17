#!/usr/bin/env python3
"""
FastAPI Application Runner with Graceful Shutdown
Run with: python run.py
"""

import asyncio
import signal
import sys
import os
import threading
import time
from typing import Optional

import uvicorn

# Fix import path when running from app directory
try:
    from app.core import get_logger
except ImportError:
    # If running from app directory, adjust import
    import sys

    sys.path.insert(0, "..")
    from app.core import get_logger

logger = get_logger()


class GracefulKiller:
    """Handles graceful shutdown signals"""

    def __init__(self):
        self.kill_now = False
        self.shutdown_event = asyncio.Event()

        # Register signal handlers
        signal.signal(signal.SIGINT, self._handle_signal)
        signal.signal(signal.SIGTERM, self._handle_signal)

        # For Windows
        if hasattr(signal, "SIGBREAK"):
            signal.signal(signal.SIGBREAK, self._handle_signal)

    def _handle_signal(self, signum, frame):
        """Handle shutdown signals"""
        signal_name = signal.Signals(signum).name
        logger.info(
            f"🛑 Received {signal_name} signal, initiating graceful shutdown..."
        )

        self.kill_now = True

        # Set shutdown event in asyncio context
        try:
            loop = asyncio.get_running_loop()
            loop.call_soon_threadsafe(self.shutdown_event.set)
        except RuntimeError:
            # No running loop, will be handled by main thread
            pass


class ApplicationRunner:
    """Main application runner with proper lifecycle management"""

    def __init__(self, reload_mode=False):
        self.server: Optional[uvicorn.Server] = None
        self.killer = GracefulKiller()
        self.shutdown_timeout = 30  # seconds
        self.reload_mode = reload_mode

    async def start_server(self):
        """Start the FastAPI server"""
        try:
            # Import app here to avoid circular imports
            try:
                from app.server import app
            except ImportError:
                # If running from app directory
                from app.server import app

            # Configure uvicorn
            config = uvicorn.Config(
                app=app,
                host="127.0.0.1",
                port=4005,
                log_level="info",  # Changed from critical to info to see reload messages
                access_log=False,
                reload=self.reload_mode,
                reload_dirs=(
                    ["app", "."] if self.reload_mode else None
                ),  # Added current dir
                reload_includes=["*.py"] if self.reload_mode else None,
                reload_excludes=(
                    ["*.pyc", "__pycache__", "*.log", "*.db", ".git", ".venv", "venv"]
                    if self.reload_mode
                    else None
                ),
                use_colors=True,  # Enable colors for better visibility
                loop="asyncio",
            )

            self.server = uvicorn.Server(config)

            if self.reload_mode:
                logger.info("🔄 Auto-reload enabled - watching for file changes...")
                logger.info(f"📁 Watching directories: {config.reload_dirs}")
                logger.info(f"📄 Watching files: {config.reload_includes}")

            logger.info("🚀 Starting FastAPI server...")
            await self.server.serve()

        except Exception as e:
            logger.error(f"💥 Failed to start server: {e}")
            raise

    async def shutdown_server(self):
        """Gracefully shutdown the server"""
        if not self.server:
            return

        logger.info("🛑 Shutting down server...")

        try:
            # Signal server to shutdown
            if hasattr(self.server, "should_exit"):
                self.server.should_exit = True

            # Wait for server to stop
            shutdown_task = asyncio.create_task(self._wait_for_server_shutdown())

            try:
                await asyncio.wait_for(shutdown_task, timeout=self.shutdown_timeout)
                logger.info("✅ Server shutdown completed")
            except asyncio.TimeoutError:
                logger.warning("⏰ Server shutdown timeout, forcing exit")

        except Exception as e:
            logger.error(f"💥 Error during server shutdown: {e}")

    async def _wait_for_server_shutdown(self):
        """Wait for server to fully shutdown"""
        while self.server and hasattr(self.server, "started") and self.server.started:
            await asyncio.sleep(0.1)

    async def run(self):
        """Main application runner"""
        try:
            # Create tasks
            server_task = asyncio.create_task(self.start_server())
            shutdown_task = asyncio.create_task(self.killer.shutdown_event.wait())

            # Wait for either server completion or shutdown signal
            done, pending = await asyncio.wait(
                [server_task, shutdown_task], return_when=asyncio.FIRST_COMPLETED
            )

            # Handle shutdown
            if shutdown_task in done:
                logger.info("🛑 Shutdown signal received, stopping server...")

                # Cancel server task if still running
                if server_task in pending:
                    server_task.cancel()
                    try:
                        await asyncio.wait_for(server_task, timeout=5.0)
                    except (asyncio.CancelledError, asyncio.TimeoutError):
                        raise

                # Shutdown server gracefully
                await self.shutdown_server()

            # Cancel any remaining tasks
            for task in pending:
                task.cancel()
                try:
                    await asyncio.wait_for(task, timeout=5.0)
                except (asyncio.CancelledError, asyncio.TimeoutError):
                    raise

        except KeyboardInterrupt:
            logger.info("🛑 KeyboardInterrupt received")
        except Exception as e:
            logger.error(f"💥 Unexpected error: {e}")
            raise
        finally:
            logger.info("🏁 Application runner stopped")


def setup_environment():
    """Setup environment and logging"""
    # Ensure we're in the right directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    # Add current directory to Python path
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)


def timeout_handler():
    """Emergency timeout handler to prevent hanging"""

    def emergency_exit():
        time.sleep(45)  # Give 45 seconds for graceful shutdown
        # Only force exit if not in reload mode
        if not getattr(timeout_handler, "reload_mode", False):
            logger.error("💥 Emergency timeout - forcing exit")
            os._exit(1)

    timeout_thread = threading.Thread(target=emergency_exit, daemon=True)
    timeout_thread.start()


def run_with_reload():
    """Run server with uvicorn directly for better reload support"""
    logger.info("🌟 Starting NLP FastAPI Application with Auto-reload")
    logger.info("🔄 Auto-reload enabled - watching for file changes...")
    logger.info("🔧 Press Ctrl+C to shutdown gracefully")

    # Get current directory
    current_dir = os.getcwd()

    try:
        # Run uvicorn directly for better reload support
        uvicorn.run(
            "app.server:app",  # Module path to app
            host="127.0.0.1",
            port=4005,
            reload=True,
            reload_dirs=[os.path.join(current_dir, "app")],  # Only watch app directory
            reload_includes=["*.py"],
            reload_excludes=[
                "*.pyc",
                "__pycache__",
                "*.log",
                "*.db",
                ".git",
                ".venv",
                "venv",
                "*.txt",
            ],
            log_level="info",
            use_colors=True,
            access_log=False,
        )
    except KeyboardInterrupt:
        logger.info("🛑 Application interrupted by user")
    except Exception as e:
        logger.error(f"💥 Error running with reload: {e}")
        raise


async def main():
    """Main entry point"""
    setup_environment()

    # Check for reload mode from environment or args
    reload_mode = (
        "--reload" in sys.argv or os.getenv("RELOAD_MODE", "").lower() == "true"
    )

    # If reload mode, use uvicorn directly for better support
    if reload_mode:
        run_with_reload()
        return

    logger.info("🌟 Starting NLP FastAPI Application")
    logger.info("🔧 Press Ctrl+C to shutdown gracefully")

    # Start emergency timeout handler (disabled in reload mode)
    timeout_handler()

    runner = ApplicationRunner(reload_mode=reload_mode)

    try:
        await runner.run()
    except Exception as e:
        logger.error(f"💥 Application failed: {e}")
        sys.exit(1)
    finally:
        logger.info("👋 Goodbye!")


if __name__ == "__main__":
    try:
        # Handle different Python versions
        if sys.version_info >= (3, 7):
            asyncio.run(main())
        else:
            loop = asyncio.get_event_loop()
            try:
                loop.run_until_complete(main())
            finally:
                loop.close()
    except KeyboardInterrupt:
        logger.info("🛑 Application interrupted by user")
    except Exception as e:
        logger.error(f"💥 Fatal error: {e}")
        sys.exit(1)
