package initialize

import (
	"payment/global"

	"github.com/payOSHQ/payos-lib-golang"
)

func InitPayOS() {
	payos.Key(
		global.Config.PayOS.ClientID,
		global.Config.PayOS.APIKey,
		global.Config.PayOS.ChecksumKey,
	)
}
