package middlewares

import (
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
)

type clientInfo struct {
	Requests     int
	ResetAt      time.Time
	FirstHitAt   time.Time
	LastHitAt    time.Time
	Blocked      bool
	BlockedUntil time.Time
}

type RateLimitConfig struct {
	MaxRequests    int                             // Số request tối đa
	Window         time.Duration                   // Thời gian window
	BlockDuration  time.Duration                   // Thời gian block khi vi phạm (0 = không block)
	KeyGenerator   func(echo.Context) string       // Hàm tạo key (mặc định: IP)
	SkipFunc       func(echo.Context) bool         // Hàm skip middleware
	ErrorHandler   func(echo.Context, error) error // Xử lý lỗi tùy chỉnh
	OnLimitReached func(echo.Context, *clientInfo) // Callback khi đạt giới hạn

	// Headers configuration
	LimitHeader      string // Header name cho limit (mặc định: X-RateLimit-Limit)
	RemainingHeader  string // Header name cho remaining (mặc định: X-RateLimit-Remaining)
	ResetHeader      string // Header name cho reset time (mặc định: X-RateLimit-Reset)
	RetryAfterHeader string // Header name cho retry after (mặc định: Retry-After)
}

type RateLimiter struct {
	config *RateLimitConfig
	store  map[string]*clientInfo
	mutex  sync.RWMutex
}

// DefaultRateLimitConfig trả về config mặc định
func DefaultRateLimitConfig() *RateLimitConfig {
	return &RateLimitConfig{
		MaxRequests:      100,
		Window:           time.Minute,
		BlockDuration:    0, // Không block
		KeyGenerator:     defaultKeyGenerator,
		SkipFunc:         nil,
		ErrorHandler:     defaultErrorHandler,
		OnLimitReached:   nil,
		LimitHeader:      "X-RateLimit-Limit",
		RemainingHeader:  "X-RateLimit-Remaining",
		ResetHeader:      "X-RateLimit-Reset",
		RetryAfterHeader: "Retry-After",
	}
}

func defaultKeyGenerator(c echo.Context) string {
	return c.RealIP()
}

func defaultErrorHandler(c echo.Context, err error) error {
	return echo.NewHTTPError(http.StatusTooManyRequests, "Rate limit exceeded. Try again later.")
}

// NewRateLimiter tạo rate limiter mới
func NewRateLimiter(config *RateLimitConfig) *RateLimiter {
	if config == nil {
		config = DefaultRateLimitConfig()
	}

	// Set default values nếu không được cung cấp
	if config.KeyGenerator == nil {
		config.KeyGenerator = defaultKeyGenerator
	}
	if config.ErrorHandler == nil {
		config.ErrorHandler = defaultErrorHandler
	}
	if config.LimitHeader == "" {
		config.LimitHeader = "X-RateLimit-Limit"
	}
	if config.RemainingHeader == "" {
		config.RemainingHeader = "X-RateLimit-Remaining"
	}
	if config.ResetHeader == "" {
		config.ResetHeader = "X-RateLimit-Reset"
	}
	if config.RetryAfterHeader == "" {
		config.RetryAfterHeader = "Retry-After"
	}

	return &RateLimiter{
		config: config,
		store:  make(map[string]*clientInfo),
	}
}

// RateLimitMiddleware trả về middleware function
func (rl *RateLimiter) RateLimitMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Skip nếu có skip function
			if rl.config.SkipFunc != nil && rl.config.SkipFunc(c) {
				return next(c)
			}

			key := rl.config.KeyGenerator(c)
			now := time.Now()

			rl.mutex.Lock()
			info, exists := rl.store[key]

			// Kiểm tra nếu client đang bị block
			if exists && info.Blocked && now.Before(info.BlockedUntil) {
				rl.mutex.Unlock()
				rl.setHeaders(c, info, 0)
				c.Response().Header().Set(rl.config.RetryAfterHeader,
					strconv.FormatInt(int64(info.BlockedUntil.Sub(now).Seconds()), 10))
				return rl.config.ErrorHandler(c, fmt.Errorf("client is temporarily blocked"))
			}

			// Reset hoặc tạo mới client info
			if !exists || now.After(info.ResetAt) || (info.Blocked && now.After(info.BlockedUntil)) {
				info = &clientInfo{
					Requests:   1,
					ResetAt:    now.Add(rl.config.Window),
					FirstHitAt: now,
					LastHitAt:  now,
					Blocked:    false,
				}
				rl.store[key] = info
			} else {
				info.Requests++
				info.LastHitAt = now
			}

			remaining := rl.config.MaxRequests - info.Requests
			if remaining < 0 {
				remaining = 0
			}

			// Kiểm tra giới hạn
			if info.Requests > rl.config.MaxRequests {
				// Block client nếu có cấu hình block duration
				if rl.config.BlockDuration > 0 {
					info.Blocked = true
					info.BlockedUntil = now.Add(rl.config.BlockDuration)
				}

				// Gọi callback nếu có
				if rl.config.OnLimitReached != nil {
					rl.config.OnLimitReached(c, info)
				}

				rl.mutex.Unlock()
				rl.setHeaders(c, info, remaining)

				if rl.config.BlockDuration > 0 {
					c.Response().Header().Set(rl.config.RetryAfterHeader,
						strconv.FormatInt(int64(rl.config.BlockDuration.Seconds()), 10))
				}

				return rl.config.ErrorHandler(c, fmt.Errorf("rate limit exceeded"))
			}

			rl.mutex.Unlock()
			rl.setHeaders(c, info, remaining)
			return next(c)
		}
	}
}

// setHeaders thiết lập các headers rate limit
func (rl *RateLimiter) setHeaders(c echo.Context, info *clientInfo, remaining int) {
	c.Response().Header().Set(rl.config.LimitHeader, strconv.Itoa(rl.config.MaxRequests))
	c.Response().Header().Set(rl.config.RemainingHeader, strconv.Itoa(remaining))
	c.Response().Header().Set(rl.config.ResetHeader, strconv.FormatInt(info.ResetAt.Unix(), 10))
}

// GetStats trả về thống kê của một client
func (rl *RateLimiter) GetStats(key string) (*clientInfo, bool) {
	rl.mutex.RLock()
	defer rl.mutex.RUnlock()

	info, exists := rl.store[key]
	if !exists {
		return nil, false
	}

	// Tạo bản copy để tránh race condition
	statsCopy := *info
	return &statsCopy, true
}

// Reset xóa thông tin rate limit của một client
func (rl *RateLimiter) Reset(key string) {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()
	delete(rl.store, key)
}

// ResetAll xóa tất cả thông tin rate limit
func (rl *RateLimiter) ResetAll() {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()
	rl.store = make(map[string]*clientInfo)
}

// Cleanup dọn dẹp các entries cũ (nên chạy định kỳ)
func (rl *RateLimiter) Cleanup() {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	now := time.Now()
	for key, info := range rl.store {
		// Xóa nếu đã hết hạn và không bị block
		if now.After(info.ResetAt) && (!info.Blocked || now.After(info.BlockedUntil)) {
			delete(rl.store, key)
		}
	}
}

// StartCleanupWorker khởi chạy worker dọn dẹp định kỳ
func (rl *RateLimiter) StartCleanupWorker(interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			rl.Cleanup()
		}
	}()
}

// Một số helper functions để tạo middleware nhanh

// RateLimitMiddleware tạo middleware với config mặc định
func RateLimitMiddleware(maxRequests int, window time.Duration) echo.MiddlewareFunc {
	config := DefaultRateLimitConfig()
	config.MaxRequests = maxRequests
	config.Window = window

	limiter := NewRateLimiter(config)
	return limiter.RateLimitMiddleware()
}

// RateLimitWithBlockMiddleware tạo middleware với block duration
func RateLimitWithBlockMiddleware(maxRequests int, window, blockDuration time.Duration) echo.MiddlewareFunc {
	config := DefaultRateLimitConfig()
	config.MaxRequests = maxRequests
	config.Window = window
	config.BlockDuration = blockDuration

	limiter := NewRateLimiter(config)
	return limiter.RateLimitMiddleware()
}

// RateLimitByUserMiddleware tạo middleware rate limit theo user ID
func RateLimitByUserMiddleware(maxRequests int, window time.Duration, userIDKey string) echo.MiddlewareFunc {
	config := DefaultRateLimitConfig()
	config.MaxRequests = maxRequests
	config.Window = window
	config.KeyGenerator = func(c echo.Context) string {
		userID := c.Get(userIDKey)
		if userID == nil {
			return c.RealIP() // Fallback to IP
		}
		return fmt.Sprintf("user:%v", userID)
	}

	limiter := NewRateLimiter(config)
	return limiter.RateLimitMiddleware()
}

// RateLimitByAPIKeyMiddleware tạo middleware rate limit theo API key
func RateLimitByAPIKeyMiddleware(maxRequests int, window time.Duration, apiKeyHeader string) echo.MiddlewareFunc {
	config := DefaultRateLimitConfig()
	config.MaxRequests = maxRequests
	config.Window = window
	config.KeyGenerator = func(c echo.Context) string {
		apiKey := c.Request().Header.Get(apiKeyHeader)
		if apiKey == "" {
			return c.RealIP() // Fallback to IP
		}
		return fmt.Sprintf("api:%s", apiKey)
	}

	limiter := NewRateLimiter(config)
	return limiter.RateLimitMiddleware()
}

// RateLimitByEndpointMiddleware tạo middleware rate limit theo endpoint
func RateLimitByEndpointMiddleware(maxRequests int, window time.Duration) echo.MiddlewareFunc {
	config := DefaultRateLimitConfig()
	config.MaxRequests = maxRequests
	config.Window = window
	config.KeyGenerator = func(c echo.Context) string {
		return fmt.Sprintf("%s:%s:%s", c.RealIP(), c.Request().Method, c.Path())
	}

	limiter := NewRateLimiter(config)
	return limiter.RateLimitMiddleware()
}

// RateLimitWithWhitelistMiddleware tạo middleware với whitelist IPs
func RateLimitWithWhitelistMiddleware(maxRequests int, window time.Duration, whitelistIPs []string) echo.MiddlewareFunc {
	whitelist := make(map[string]bool)
	for _, ip := range whitelistIPs {
		whitelist[ip] = true
	}

	config := DefaultRateLimitConfig()
	config.MaxRequests = maxRequests
	config.Window = window
	config.SkipFunc = func(c echo.Context) bool {
		clientIP := c.RealIP()
		return whitelist[clientIP]
	}

	limiter := NewRateLimiter(config)
	return limiter.RateLimitMiddleware()
}
