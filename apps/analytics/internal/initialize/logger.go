package initialize

import (
	"analytics/global"
	"analytics/pkg/logger"
)

func InitLogger() {
	global.Logger = logger.NewLogger(global.Config.Logger)
}
