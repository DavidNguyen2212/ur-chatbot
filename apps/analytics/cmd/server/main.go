package main

import (
	"analytics/global"
	"analytics/internal/initialize"
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func main() {
	//  1. Load config first
	initialize.LoadConfig()
	initialize.InitLogger()
	global.Logger.Info("Config & Logger initialized")

	// 2. Create gRPC connections with config
	chatConn, err := createGRPCConnection(global.Config.Services.ChatService.Host, global.Config.Services.ChatService.Port)
	if err != nil {
		global.Logger.Fatal("Cannot connect to Chat-Service", zap.Error(err))
	}
	defer closeConnection(chatConn, "Chat-Service")

	paymentConn, err := createGRPCConnection(global.Config.Services.PaymentService.Host, global.Config.Services.PaymentService.Port)
	if err != nil {
		global.Logger.Fatal("Cannot connect to Payment-Service", zap.Error(err))
	}
	defer closeConnection(paymentConn, "Payment-Service")

	// 3. Initialize và run application
	app := initialize.NewApp(chatConn, paymentConn)

	// 4. Graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		if err := app.Run(ctx); err != nil {
			global.Logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	waitForShutdown(cancel)
}

func createGRPCConnection(host string, port int) (*grpc.ClientConn, error) {
	address := fmt.Sprintf("%s:%d", host, port)
	global.Logger.Info("Connecting to gRPC service", zap.String("address", address))

	_, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	conn, err := grpc.NewClient(
		address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to %s: %w", address, err)
	}

	global.Logger.Info("Successfully connected to gRPC service", zap.String("address", address))
	return conn, nil
}

func waitForShutdown(cancel context.CancelFunc) {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	sig := <-sigChan
	global.Logger.Info("Received signal, shutting down", zap.String("signal", sig.String()))
	cancel()

	// Give some time for graceful shutdown
	time.Sleep(2 * time.Second)
}

func closeConnection(conn *grpc.ClientConn, serviceName string) {
	if err := conn.Close(); err != nil {
		global.Logger.Error("Failed to close connection",
			zap.String("service", serviceName),
			zap.Error(err))
	} else {
		global.Logger.Info("Connection closed", zap.String("service", serviceName))
	}
}
