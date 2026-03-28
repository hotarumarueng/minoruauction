.PHONY: build test clean

# Lambda 向け arm64 クロスコンパイル
# GOOS=linux GOARCH=arm64 で provided.al2023 (arm64) 向けバイナリを生成する
BUILD_FLAGS = GOOS=linux GOARCH=arm64 CGO_ENABLED=0
BUILD_OPTS  = -buildvcs=false

DIST = dist

build: $(DIST)/room-handler/bootstrap $(DIST)/task-handler/bootstrap

$(DIST)/room-handler/bootstrap:
	mkdir -p $(DIST)/room-handler
	$(BUILD_FLAGS) go build $(BUILD_OPTS) -o $(DIST)/room-handler/bootstrap ./cmd/room-handler

$(DIST)/task-handler/bootstrap:
	mkdir -p $(DIST)/task-handler
	$(BUILD_FLAGS) go build $(BUILD_OPTS) -o $(DIST)/task-handler/bootstrap ./cmd/task-handler

test:
	go test ./...

clean:
	rm -rf $(DIST)
