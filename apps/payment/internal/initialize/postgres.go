package initialize

import (
	"fmt"
	"payment/global"
	"payment/internal/models"
	"time"

	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func checkErrorPanic(err error, errString string) {
	if err != nil {
		global.Logger.Error(errString, zap.Error(err))
		panic(err)
	}
}

func InitPostgreSQL() {
	m := global.Config.PostgreSQL
	dsn := m.Url
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		SkipDefaultTransaction: false,
	})
	checkErrorPanic(err, "Init PostgreSQL failed")
	global.Logger.Info("Init PostgreSQL success")
	global.PgDB = db

	// Set pool => mở nhóm kết nối, cải thiện hiệu suất
	// Việc mở connect, đóng connect liên tục sẽ tốn tài nguyên => Pool ra đời để khắc phục
	setPool()
	migrateTables()
}

func setPool() {
	m := global.Config.PostgreSQL
	sqlDb, err := global.PgDB.DB()
	if err != nil {
		fmt.Printf("Postgresql error: %s::", err)
	}
	// Khi có nhiều kết nối nhàn rỗi => việc phục hồi kết nối cho yêu cầu mới nhanh hơn
	// Nhưng nếu có quá nhiều => không cần thiết
	sqlDb.SetConnMaxIdleTime(time.Duration(m.MaxIdleConns))
	// Giới hạn số kết nối tối đa, tránh quá tải cho server
	// Nếu quá hạn, các yêu cầu mới cần xếp hàng
	sqlDb.SetMaxOpenConns(m.MaxOpenConns)
	// Sau khi kết nối vừa tồn tại, quá hạn thì bị đóng và thải khỏi pool, tránh rò rỉ bộ nhớ hoặc kết nối k được giải phóng gây mất mát tài nguyên
	sqlDb.SetConnMaxLifetime(m.ConnMaxLifetime)
}

func migrateTables() {
	err := global.PgDB.AutoMigrate(
		&models.SubscriptionTier{},
		&models.OrganizationSubscription{},
	)
	if err != nil {
		global.Logger.Error("Migration error", zap.Error(err))
	}
	global.Logger.Info("Auto migration completed")
}
