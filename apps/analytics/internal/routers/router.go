package routers

import (
	"analytics/internal/constant/enums"
	"analytics/internal/controllers"
	"analytics/internal/middlewares"
	"analytics/internal/services"
	"time"

	"analytics/proto/chat"
	"analytics/proto/payment"

	echo "github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"google.golang.org/grpc"
)

func SetupRouterWithServices(analyticService *services.AnalyticService, chatConn, paymentConn *grpc.ClientConn) *echo.Echo {
	var chatClient chat.ChatServiceClient = chat.NewChatServiceClient(chatConn)
	var paymentClient payment.PaymentServiceClient = payment.NewPaymentServiceClient(paymentConn)

	analyticController := controllers.NewAnalyticController(analyticService, chatClient, paymentClient)

	return setupRoutes(analyticController)
}

func setupRoutes(analyticController *controllers.AnalyticController) *echo.Echo {
	e := echo.New()

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{echo.GET, echo.POST, echo.PUT, echo.DELETE},
		AllowHeaders:     []string{"Origin", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))
	e.HTTPErrorHandler = middlewares.CustomHTTPErrorHandler
	// Public routes
	// e.GET("/tiers", tierController.ListSubscriptionTier)

	// Protected analytics routes
	analytics := e.Group("/analytics")
	analytics.Use(middlewares.LoggerMiddleware, middlewares.AuthMiddleware(), middlewares.RoleGuard(enums.RoleAdmin, enums.RoleOwner), middlewares.RateLimitWithBlockMiddleware(100, time.Minute, 5*time.Minute))
	{
		analytics.GET("/chats/daily", analyticController.SummarizeDailyChat)
		analytics.GET("/chats/all-time", analyticController.SummarizeChatAllTimeStats)
		analytics.GET("/subscriptions/monthly", analyticController.SummarizeMonthlySubscription)
		analytics.GET("/payments/monthly", analyticController.SummarizeMonthlyPaymentsReport)
		analytics.GET("/organization-usage/snapshot", analyticController.SummarizeOrganizationUsageSnapshot)
	}

	return e
}
