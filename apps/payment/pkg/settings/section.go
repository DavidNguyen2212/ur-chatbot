package settings

import "time"

type Config struct {
	Server     ServerSetting     `mapstructure:"server"`
	PostgreSQL PostgreSQLSetting `mapstructure:"postgreSQL"`
	Logger     LoggerSetting     `mapstructure:"logger"`
	Security   SecuritySetting   `mapstructure:"security"`
	Frontend   FrontendSetting   `mapstructure:"frontend"`
	PayOS      PayOSSetting      `mapstructure:"payos"`
}

type ServerSetting struct {
	Port int `mapstructure:"port"`
}

type PostgreSQLSetting struct {
	Url             string        `mapstructure:"url"`
	MaxIdleConns    int           `mapstructure:"maxIdleConns"`
	MaxOpenConns    int           `mapstructure:"maxOpenConns"`
	ConnMaxLifetime time.Duration `mapstructure:"connMaxLifetime"`
}

type LoggerSetting struct {
	LogLevel    string `mapstructure:"log_level"`
	FileLogName string `mapstructure:"file_log_name"`
	MaxSize     int    `mapstructure:"max_size"`
	MaxBackups  int    `mapstructure:"max_backups"`
	MaxAge      int    `mapstructure:"max_age"`
	Compress    bool   `mapstructure:"compress"`
}

type SecuritySetting struct {
	JWT JWTConfig `mapstructure:"jwt"`
}

type JWTConfig struct {
	Key string `mapstructure:"key"`
}

type PayOSSetting struct {
	ClientID    string `env:"PAYOS_CLIENT_ID"`
	APIKey      string `env:"PAYOS_API_KEY"`
	ChecksumKey string `env:"PAYOS_CHECKSUM_KEY"`
}

type FrontendSetting struct {
	URL string `mapstructure:"url"`
}
