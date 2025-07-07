package initialize

import (
	"payment/global"
	"payment/pkg/logger"
)

func InitLogger() {
	global.Logger = logger.NewLogger(global.Config.Logger)
}
