package middlewares

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type clientInfo struct {
	Requests int
	ResetAt  time.Time
}

var (
	rateLimitStore = make(map[string]*clientInfo)
	mutex          = sync.Mutex{}
)

func RateLimitMiddleware(maxRequests int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()

		mutex.Lock()
		info, exists := rateLimitStore[clientIP]
		now := time.Now()

		if !exists || now.After(info.ResetAt) {
			// Reset the counter
			info = &clientInfo{
				Requests: 1,
				ResetAt:  now.Add(window),
			}
			rateLimitStore[clientIP] = info
		} else {
			info.Requests++
		}

		mutex.Unlock()

		if info.Requests > maxRequests {
			c.Header("X-RateLimit-Limit", strconv.Itoa(maxRequests))
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("X-RateLimit-Reset", info.ResetAt.Format(time.RFC1123))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded. Try again later.",
			})
			c.Abort()
			return
		}

		// Optional: return rate limit headers
		c.Header("X-RateLimit-Limit", strconv.Itoa(maxRequests))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(maxRequests-info.Requests))
		c.Header("X-RateLimit-Reset", info.ResetAt.Format(time.RFC1123))

		c.Next()
	}
}
