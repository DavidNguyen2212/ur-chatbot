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
	TotalConversations          int32   `json:"total_conversations"`
	AIConversations             int32   `json:"ai_conversations"`
	HumanConversations          int32   `json:"human_conversations"`
	TotalMessages               int32   `json:"total_messages"`
	CustomerMessages            int32   `json:"customer_messages"`
	AgentMessages               int32   `json:"agent_messages"`
	AIMessages                  int32   `json:"ai_messages"`
	AvgMessagesPerConversation  float32 `json:"avg_messages_per_conversation"`
	AvgConversationDurationMins float32 `json:"avg_conversation_duration_minutes"`
	FirstConversationDate       string  `json:"first_conversation_date"`
	LastConversationDate        string  `json:"last_conversation_date"`
	BusiestDay                  string  `json:"busiest_day"`
	BusiestDayConversationCount int32   `json:"busiest_day_conversation_count"`
}
