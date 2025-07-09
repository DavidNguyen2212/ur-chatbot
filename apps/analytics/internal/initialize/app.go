package initialize

import (
	"analytics/global"
	"analytics/internal/routers"
	"analytics/internal/services"
	"context"
	"fmt"
	"net/http"
	"time"

	"go.uber.org/zap"
	"google.golang.org/grpc"
)

type App struct {
	chatConn    *grpc.ClientConn
	paymentConn *grpc.ClientConn
	server      *http.Server
}

func NewApp(chatConn, paymentConn *grpc.ClientConn) *App {
	return &App{
		chatConn:    chatConn,
		paymentConn: paymentConn,
	}
}

func (a *App) Run(ctx context.Context) error {
	// Initialize services
	analyticService := services.NewAnalyticService()

	// Setup router with services
	r := routers.SetupRouterWithServices(analyticService, a.chatConn, a.paymentConn)

	// Initialize Kafka consumers with subscription service, ...
	// InitKafkaConsumers(analyticService)

	port := fmt.Sprintf(":%d", global.Config.Server.Port)
	a.server = &http.Server{
		Addr:    port,
		Handler: r,
	}
	global.Logger.Info("Starting server...", zap.String("port", port))

	// Start server in goroutine
	go func() {
		if err := a.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			global.Logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for context cancellation
	<-ctx.Done()

	// Graceful shutdown
	return a.shutdown()
}

func (a *App) shutdown() error {
	global.Logger.Info("Shutting down server...")

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Shutdown HTTP server
	if err := a.server.Shutdown(ctx); err != nil {
		global.Logger.Error("Server shutdown failed", zap.Error(err))
		return err
	}

	global.Logger.Info("Server shutdown completed")
	return nil
}
