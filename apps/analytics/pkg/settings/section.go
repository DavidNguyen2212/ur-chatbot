package settings

type Config struct {
	Server   ServerSetting   `mapstructure:"server"`
	Logger   LoggerSetting   `mapstructure:"logger"`
	Security SecuritySetting `mapstructure:"security"`
	Frontend FrontendSetting `mapstructure:"frontend"`
	Services ServicesSetting `mapstructure:"services"`
}

type ServerSetting struct {
	Port int `mapstructure:"port"`
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

type FrontendSetting struct {
	URL string `mapstructure:"url"`
}

type ServicesSetting struct {
	ChatService    ServiceConfig `mapstructure:"chat_service"`
	PaymentService ServiceConfig `mapstructure:"payment_service"`
}

type ServiceConfig struct {
	Host string `mapstructure:"host"`
	Port int    `mapstructure:"port"`
}
