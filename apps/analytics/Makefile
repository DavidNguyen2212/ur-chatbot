# name app
APP_NAME = server

dev:
	air -c .air.toml
proto-gen:
	protoc --go_out=. --go-grpc_out=. proto/chat/chat.proto
	protoc --go_out=. --go-grpc_out=. proto/payment/payment.proto