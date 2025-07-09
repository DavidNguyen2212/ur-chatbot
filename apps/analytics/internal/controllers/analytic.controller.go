package controllers

import (
	"analytics/internal/dtos"
	"analytics/internal/services"
	"analytics/pkg/response"
	"analytics/proto/chat"
	"analytics/proto/payment"
	"context"
	"net/http"
	"time"

	echo "github.com/labstack/echo/v4"
)

type AnalyticController struct {
	analyticService      *services.AnalyticService
	chatServiceClient    chat.ChatServiceClient
	paymentServiceClient payment.PaymentServiceClient
}

// Sửa constructor để nhận thêm 2 gRPC client
func NewAnalyticController(
	analyticService *services.AnalyticService,
	chatClient chat.ChatServiceClient,
	paymentClient payment.PaymentServiceClient,
) *AnalyticController {
	return &AnalyticController{
		analyticService:      analyticService,
		chatServiceClient:    chatClient,
		paymentServiceClient: paymentClient,
	}
}

// SummarizeDailyChat godoc
// @Summary Tóm tắt thống kê chat trong ngày
// @Description Lấy dữ liệu tổng hợp cuộc hội thoại theo ngày cho tổ chức của người dùng hiện tại.
// @Tags Analytics
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param date_exact query string false "Ngày chính xác (format YYYY-MM-DD)"
// @Param date_gte query string false "Ngày từ (>=) (format YYYY-MM-DD)"
// @Param date_lte query string false "Ngày đến (<=) (format YYYY-MM-DD)"
// @Param ordering query string false "Sắp xếp (ví dụ: -date)"
// @Param page query int false "Số trang"
// @Param page_size query int false "Số phần tử mỗi trang"
// @Success 200 {object} dtos.DailyChatSummaryResponse
// @Failure 400 {object} response.ResponseData "Bad request"
// @Failure 500 {object} response.ResponseData "Internal server error"
// @Router /analytics/chats/daily [get]
func (ac *AnalyticController) SummarizeDailyChat(c echo.Context) error {
	var query dtos.GetDailyChatSummaryQuery
	if err := c.Bind(&query); err != nil {
		response.ErrorResponse(c, http.StatusBadRequest, "Query params not valid")
	}

	// Get current user from JWT
	current_user := c.Get("user").(dtos.CoolJwtPayload)

	// Set query values
	query.SetDefaults("-date")

	// Validate date formats
	if err := query.ValidateDateFormats(); err != nil {
		response.ErrorResponse(c, http.StatusBadRequest, "Query params not valid: date")
	}

	// Create gRPC request
	req := &chat.GetDailyChatSummaryRequest{
		OrganizationId: current_user.Organization.ID.String(),
		DateExact:      query.DateExact,
		DateGte:        query.DateGte,
		DateLte:        query.DateLte,
		Ordering:       query.Ordering,
		Page:           query.Page,
		PageSize:       query.PageSize,
	}

	// Call chat service to get
	chatCtx, chatCancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer chatCancel()
	resp, err := ac.chatServiceClient.GetDailyChatSummary(chatCtx, req)
	if err != nil {
		return response.ErrorResponse(c, http.StatusInternalServerError, "Failed to get Daily Chat Summary")
	}

	// Convert proto response to DTO
	result := &dtos.DailyChatSummaryResponse{
		Count:    resp.Count,
		Next:     resp.Next,
		Previous: resp.Previos,
		Results:  make([]dtos.DailyChatSummaryDTO, len(resp.Results)),
	}

	for i, item := range resp.Results {
		result.Results[i] = dtos.DailyChatSummaryDTO{
			OrganizationID:                 item.OrganizationId,
			Date:                           item.Date,
			TotalConversations:             item.TotalConversations,
			AIConversations:                item.AiConversations,
			HumanConversations:             item.HumanConversations,
			AvgConversationDurationMinutes: item.AvgConversationDurationMinutes,
			TotalMessages:                  item.TotalMessages,
			CustomerMessages:               item.CustomerMessages,
			AgentMessages:                  item.AgentMessages,
			AIMessages:                     item.AiMessages,
		}
	}

	return response.SuccessResponse(c, result)
}

// SummarizeMonthlySubscription godoc
// @Summary Tóm tắt thống kê gói đăng ký theo tháng
// @Description Lấy dữ liệu tổng hợp về subscription của tổ chức theo từng tháng
// @Tags Analytics
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param month_exact query string false "Tháng chính xác (YYYY-MM)"
// @Param month_gte query string false "Tháng từ (>=) (YYYY-MM)"
// @Param month_lte query string false "Tháng đến (<=) (YYYY-MM)"
// @Param ordering query string false "Sắp xếp, ví dụ: -month"
// @Param page query int false "Số trang"
// @Param page_size query int false "Số phần tử mỗi trang"
// @Success 200 {object} dtos.MonthlySubscriptionSummaryResponse
// @Failure 400 {object} response.ResponseData "Bad request"
// @Failure 500 {object} response.ResponseData "Internal server error"
// @Router /analytics/monthly-subscription-summary [get]
func (ac *AnalyticController) SummarizeMonthlySubscription(c echo.Context) error {
	var query dtos.GetMonthlySubscriptionSummaryQuery
	if err := c.Bind(&query); err != nil {
		return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid query params"})
	}

	// Get current user from JWT
	current_user := c.Get("user").(dtos.CoolJwtPayload)

	// Set query values
	query.SetDefaults("-month")

	// Validate date formats
	if err := query.ValidateMonthFormats(); err != nil {
		return c.JSON(http.StatusBadRequest, echo.Map{"error": err.Error()})
	}

	// Create gRPC request
	req := &payment.GetMonthlySubscriptionSummaryRequest{
		OrganizationId: current_user.Organization.ID.String(),
		MonthExact:     query.MonthExact,
		MonthGte:       query.MonthGte,
		MonthLte:       query.MonthLte,
		Ordering:       query.Ordering,
		Page:           query.Page,
		PageSize:       query.PageSize,
	}

	// Call chat service to get
	subCtx, subCancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer subCancel()
	resp, err := ac.paymentServiceClient.GetMonthlySubscriptionSummary(subCtx, req)
	if err != nil {
		return response.ErrorResponse(c, http.StatusInternalServerError, "Cannot get monthly subscription summary")
	}

	// Convert proto response to DTO
	result := &dtos.MonthlySubscriptionSummaryResponse{
		Count:    resp.Count,
		Next:     resp.Next,
		Previous: resp.Previos,
		Results:  make([]dtos.MonthlySubscriptionSummaryDTO, len(resp.Results)),
	}
	for i, item := range resp.Results {
		result.Results[i] = dtos.MonthlySubscriptionSummaryDTO{
			Month:                    item.Month,
			NewSubscriptionThisMonth: item.NewSubscriptionsThisMonth,
			ActiveSubscriptions:      item.ActiveSubscriptions,
			TrialSubscriptions:       item.TrialSubscriptions,
			CanceledSubscriptions:    item.CanceledSubscriptions,
			MonthlyRevenue:           item.MonthlyRevenue,
			TrialConversionRate:      item.TrialConversionRate,
		}
	}

	return response.SuccessResponse(c, result)
}

func (ac *AnalyticController) SummarizeMonthlyPaymentsReport(c echo.Context) error {
	var query dtos.GetMonthlyPaymentsReportQuery
	if err := c.Bind(&query); err != nil {
		return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid query params"})
	}

	current_user := c.Get("user").(dtos.CoolJwtPayload)
	if current_user.Organization == nil {
		return c.JSON(http.StatusForbidden, echo.Map{"error": "organization required"})
	}

	// Set defaults
	query.SetDefaults("-month")

	// Validate month format
	if err := query.ValidateMonthFormats(); err != nil {
		return c.JSON(http.StatusBadRequest, echo.Map{"error": err.Error()})
	}

	// gRPC request
	req := &payment.GetMonthlyPaymentsReportRequest{
		OrganizationId: current_user.Organization.ID.String(),
		MonthExact:     query.MonthExact,
		MonthGte:       query.MonthGte,
		MonthLte:       query.MonthLte,
		Ordering:       query.Ordering,
		Page:           int32(query.Page),
		PageSize:       int32(query.PageSize),
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	resp, err := ac.paymentServiceClient.GetMonthlyPaymentsReport(ctx, req)
	if err != nil {
		return response.ErrorResponse(c, http.StatusInternalServerError, "Cannot get monthly payments report")
	}

	// Build response DTO
	result := &dtos.MonthlyPaymentsReportResponse{
		Count:    resp.Count,
		Next:     resp.Next,
		Previous: resp.Previous,
		Results:  make([]dtos.MonthlyPaymentsReportDTO, len(resp.Results)),
	}

	for i, item := range resp.Results {
		result.Results[i] = dtos.MonthlyPaymentsReportDTO{
			Month:                     item.Month,
			TotalPayments:             item.TotalPayments,
			TotalAmount:               item.TotalAmount,
			SubscriptionPayments:      item.SubscriptionPayments,
			SubscriptionAmount:        item.SubscriptionAmount,
			AdditionalChargePayments:  item.AdditionalChargePayments,
			AdditionalChargeAmount:    item.AdditionalChargeAmount,
			MonthlySubscriptionAmount: item.MonthlySubscriptionAmount,
			YearlySubscriptionAmount:  item.YearlySubscriptionAmount,
			CompletedPayments:         item.CompletedPayments,
			CompletedAmount:           item.CompletedAmount,
			PendingPayments:           item.PendingPayments,
			FailedPayments:            item.FailedPayments,
			RefundedPayments:          item.RefundedPayments,
			PayosPaymentAmount:        item.PayosPaymentAmount,
			BankTransferAmount:        item.BankTransferAmount,
			CreditCardAmount:          item.CreditCardAmount,
		}
	}

	return response.SuccessResponse(c, result)
}

// SummarizeMonthlyPaymentsReport godoc
// @Summary Báo cáo thanh toán theo tháng
// @Description Lấy báo cáo chi tiết các khoản thanh toán trong tháng theo tổ chức
// @Tags Analytics
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param month_exact query string false "Tháng chính xác (YYYY-MM)"
// @Param month_gte query string false "Tháng từ (>=) (YYYY-MM)"
// @Param month_lte query string false "Tháng đến (<=) (YYYY-MM)"
// @Param ordering query string false "Sắp xếp (ví dụ: -month)"
// @Param page query int false "Trang"
// @Param page_size query int false "Kích thước trang"
// @Success 200 {object} dtos.MonthlyPaymentsReportResponse
// @Failure 400 {object} response.ResponseData "Bad request"
// @Failure 403 {object} response.ResponseData "Organization required"
// @Failure 500 {object} response.ResponseData "Internal server error"
// @Router /analytics/monthly-payments-report [get]
func (ac *AnalyticController) SummarizeOrganizationUsageSnapshot(c echo.Context) error {
	var query dtos.GetOrganizationUsageSnapshotQuery
	if err := c.Bind(&query); err != nil {
		return c.JSON(http.StatusBadRequest, echo.Map{"error": "invalid query params"})
	}

	current_user := c.Get("user").(dtos.CoolJwtPayload)
	if current_user.Organization == nil {
		return c.JSON(http.StatusForbidden, echo.Map{"error": "organization required"})
	}

	// Defaults
	query.SetDefaults("id")
	orgIDs := []string{current_user.Organization.ID.String()}
	if len(query.IDIn) > 0 {
		orgIDs = query.IDIn
	} else if query.ID != "" {
		orgIDs = []string{query.ID}
	}

	req := &payment.GetOrganizationUsageSnapshotRequest{
		OrganizationIds: orgIDs,
		Ordering:        query.Ordering,
		Page:            int32(query.Page),
		PageSize:        int32(query.PageSize),
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	resp, err := ac.paymentServiceClient.GetOrganizationUsageSnapshot(ctx, req)
	if err != nil {
		return response.ErrorResponse(c, http.StatusInternalServerError, "Cannot get Organization Usage Snapshot")
	}

	// Convert proto to DTO
	result := &dtos.OrganizationUsageSnapshotResponse{
		Count:    resp.Count,
		Next:     resp.Next,
		Previous: resp.Previous,
		Results:  make([]dtos.OrganizationUsageSnapshotDTO, len(resp.Results)),
	}

	for i, item := range resp.Results {
		result.Results[i] = dtos.OrganizationUsageSnapshotDTO{
			ID:                  item.Id,
			Name:                item.Name,
			StorageUsedMB:       item.StorageUsedMb,
			StorageLimitMB:      item.StorageLimitMb,
			StorageUsagePercent: item.StorageUsagePercent,
			DocumentCount:       item.DocumentCount,
			HumanAgentCount:     item.HumanAgentCount,
			AIQueriesUsed:       item.AiQueriesUsed,
			AIQueriesLimit:      item.AiQueriesLimit,
			AIUsagePercent:      item.AiUsagePercent,
			SubscriptionTier:    item.SubscriptionTier,
			SubscriptionStatus:  item.SubscriptionStatus,
		}
	}

	return response.SuccessResponse(c, result)
}

// SummarizeChatAllTimeStats godoc
// @Summary Thống kê tổng quan cuộc hội thoại từ trước đến nay
// @Description Trả về các thống kê tổng hợp cho toàn bộ cuộc hội thoại của tổ chức
// @Tags Analytics
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} dtos.ChatAllTimeStatsDTO
// @Failure 500 {object} response.ResponseData "Internal server error"
// @Router /analytics/chat-all-time-stats [get]
func (ac *AnalyticController) SummarizeChatAllTimeStats(c echo.Context) error {
	currentUser := c.Get("user").(dtos.CoolJwtPayload)
	orgID := currentUser.Organization.ID.String()

	req := &chat.GetAllTimeStatsRequest{
		OrganizationId: orgID,
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	resp, err := ac.chatServiceClient.GetAllTimeStats(ctx, req)
	if err != nil {
		return response.ErrorResponse(c, http.StatusInternalServerError, "Cannot get All time stats")
	}

	// Convert proto response to DTO
	result := dtos.ChatAllTimeStatsDTO{
		TotalConversations:          resp.TotalConversations,
		AIConversations:             resp.AiConversations,
		HumanConversations:          resp.HumanConversations,
		TotalMessages:               resp.TotalMessages,
		CustomerMessages:            resp.CustomerMessages,
		AgentMessages:               resp.AgentMessages,
		AIMessages:                  resp.AiMessages,
		AvgMessagesPerConversation:  resp.AvgMessagesPerConversation,
		AvgConversationDurationMins: resp.AvgConversationDurationMinutes,
		BusiestDay:                  resp.BusiestDay,
		BusiestDayConversationCount: resp.BusiestDayConversationCount,
		FirstConversationDate:       resp.FirstConversationDate,
		LastConversationDate:        resp.LastConversationDate,
	}

	return response.SuccessResponse(c, result)
}
