proto-gen:
	npx grpc_tools_node_protoc \
		--proto_path=src/proto \
		--js_out=import_style=commonjs,binary:generated \
		--grpc_out=generated \
		src/proto/*.proto
