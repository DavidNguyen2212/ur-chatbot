package initialize

import (
	"analytics/global"
	"fmt"
	"log"
	"os"

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
	global.Config.Security.JWT.Key = getEnvOrPanic("JWT_SECRET")
}
