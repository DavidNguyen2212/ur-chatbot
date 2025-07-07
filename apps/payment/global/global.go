package global

import (
	"payment/pkg/logger"
	"payment/pkg/settings"

	"gorm.io/gorm"
)

var (
	Config settings.Config
	Logger *logger.LoggerZap
	PgDB   *gorm.DB
)
