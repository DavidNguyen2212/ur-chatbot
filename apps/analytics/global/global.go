package global

import (
	"analytics/pkg/logger"
	"analytics/pkg/settings"
)

var (
	Config settings.Config
	Logger *logger.LoggerZap
	// PgDB   *gorm.DB
)
