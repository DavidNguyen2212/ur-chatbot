package initialize

import (
	"fmt"
	"log"
	"os"
	"payment/global"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

func getEnvOrPanic(key string) string {
	value := os.Getenv(key)
	if value == "" {
		panic(fmt.Sprintf("Environment variable '%s' is not set", key))
	}
	return value
}

func LoadConfig() {
	if err := godotenv.Load(); err != nil {
		log.Println(".env file not found, skipping...")
	}

	cfg := viper.New()
	cfg.AddConfigPath("./config/")
	cfg.SetConfigName("local")
	cfg.SetConfigType("yaml")

	if err := cfg.ReadInConfig(); err != nil {
		panic(fmt.Errorf("Read config failed: %w", err))
	}

	if err := cfg.Unmarshal(&global.Config); err != nil {
		panic(fmt.Errorf("Unable to decode config: %w", err))
	}

	// Load secrets
	global.Config.PostgreSQL.Url = getEnvOrPanic("DATABASE_URL")
	global.Config.Security.JWT.Key = getEnvOrPanic("JWT_SECRET")
	// global.Config.PayOS.APIKey = getEnvOrPanic("PAYOS_API_KEY")
	// global.Config.PayOS.ClientID = getEnvOrPanic("PAYOS_CLIENT_ID")
	// global.Config.PayOS.ChecksumKey = getEnvOrPanic("PAYOS_CHECKSUM_KEY")
}
