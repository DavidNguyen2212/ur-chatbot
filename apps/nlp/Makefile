# Makefile
.PHONY: dev dev-fast kill restart clean

# Kiểm tra watchfiles
check-watchfiles:
	@uv run python -c "try: import watchfiles; print('watchfiles: OK'); except: print('watchfiles: NOT FOUND')"

# Chạy dev với fastapi cơ bản
dev:
	uv run python run.py

dev-reload:
	set RELOAD_MODE=true && uv run python run.py --reload

# Chạy dev với watchfiles & uvicorn
dev-fast:
	uvicorn app.server:app --reload --host 127.0.0.1 --port 4005 \
		--reload-dir app \
		--reload-include "*.py" \
		--reload-exclude "*.pyc" \
		--reload-exclude "__pycache__" \
		--reload-exclude "*.log" \
		--reload-exclude "*.db" \
		--log-level critical \
		--no-access-log

proto-gen:
	uv run python -m grpc_tools.protoc \
		-I . --python_betterproto_out=generated \
		proto/*.proto

proto-gen2:
	uv run python -m grpc_tools.protoc \
		--proto_path=proto \
		--python_out=app/generated \
		--grpc_python_out=app/generated \
		--protobuf-to-pydantic_out=app/generated \
		proto/*.proto
proto-gen3:
	uv run python -m grpc_tools.protoc \
	--proto_path=proto \
	--python_out=app/generated \
	--grpclib_python_out=app/generated \
	--protobuf-to-pydantic_out=app/generated \
	proto/*.proto

clean-proto:
	rm -rf generated/*
# use loop uvloop on docker
# Dev sạch sẽ (ít log nhất)
dev-clean:
	uv run uvicorn app.server:app --reload --host 127.0.0.1 --port 4005 \
		--reload-dir app \
		--reload-delay 0.1 \
		--log-level critical \
		--no-access-log \
		--loop asyncio \
		--no-server-header

# Kill server
kill:
	pkill -f "uvicorn.*app.server:app" || true
	lsof -ti:4005 | xargs kill -9 || true

# Restart server
restart: kill
	sleep 1
	make dev

# Clean bytecode
clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete

# Debug mode
debug:
	uvicorn app.server:app --reload --host 127.0.0.1 --port 4005 \
		--reload-dir app \
		--log-level debug


# Production-like
prod:
	uvicorn app.server:app --host 127.0.0.1 --port 4005 \
		--workers 1 \
		--no-access-log