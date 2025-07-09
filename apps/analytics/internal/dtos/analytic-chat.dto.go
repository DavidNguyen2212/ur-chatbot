package dtos

import (
	"fmt"
	"time"
)

/*
DTO for DailyChatSummary
*/
type GetDailyChatSummaryQuery struct {
	BaseQuery
	OrganizationID string `query:"organization"`
	DateExact      string `query:"date"`
	DateGte        string `query:"date__gte"`
	DateLte        string `query:"date__lte"`
}

func (g *GetDailyChatSummaryQuery) ValidateDateFormats() error {
	dates := []string{g.DateExact, g.DateGte, g.DateLte}
	for _, d := range dates {
		if d == "" {
			continue
		}
		_, err := time.Parse("2006-01-02", d)
		if err != nil {
			return fmt.Errorf("invalid date format: %s", d)
		}
	}
	return nil
}

type DailyChatSummaryResponse struct {
	Count    int32                 `json:"count"`
	Next     string                `json:"next"`
	Previous string                `json:"previous"`
	Results  []DailyChatSummaryDTO `json:"results"`
}

type DailyChatSummaryDTO struct {
	OrganizationID                 string  `json:"organization"`
	Date                           string  `json:"date"`
	TotalConversations             int32   `json:"total_conversations"`
	AIConversations                int32   `json:"ai_conversations"`
	HumanConversations             int32   `json:"human_conversations"`
	AvgConversationDurationMinutes float64 `json:"avg_conversation_duration_minutes"`
	TotalMessages                  int32   `json:"total_messages"`
	CustomerMessages               int32   `json:"customer_messages"`
	AgentMessages                  int32   `json:"agent_messages"`
	AIMessages                     int32   `json:"ai_messages"`
}

type ChatAllTimeStatsDTO struct {
	TotalConversations          int32   `json:"total_conversations" example:"1250"`
	AIConversations             int32   `json:"ai_conversations" example:"800"`
	HumanConversations          int32   `json:"human_conversations" example:"450"`
	TotalMessages               int32   `json:"total_messages" example:"9500"`
	CustomerMessages            int32   `json:"customer_messages" example:"6000"`
	AgentMessages               int32   `json:"agent_messages" example:"2500"`
	AIMessages                  int32   `json:"ai_messages" example:"1000"`
	AvgMessagesPerConversation  float64 `json:"avg_messages_per_conversation" example:"7.6"`
	AvgConversationDurationMins float64 `json:"avg_conversation_duration_mins" example:"4.2"`
	BusiestDay                  string  `json:"busiest_day" example:"2025-07-01"`
	BusiestDayConversationCount int32   `json:"busiest_day_conversation_count" example:"220"`
	FirstConversationDate       string  `json:"first_conversation_date" example:"2024-01-10"`
	LastConversationDate        string  `json:"last_conversation_date" example:"2025-07-08"`
}
