package response

const (
	ErrCodeSuccess        = 20001 // Success
	ErrCodeParamInvalid   = 20003 // Email is invalid
	ErrFetchSubscription  = 20004
	ErrUnauthorizedHeader = 20005
	ErrInvalidToken       = 20006
	ErrInvalidTokenClaims = 20007
	ErrRateLimitExceeded  = 20008 // Rate limit exceeded
)

// message
var Msg = map[int]string{
	ErrCodeSuccess:        "success",
	ErrCodeParamInvalid:   "Email is invalid",
	ErrFetchSubscription:  "Failed to fetch subscription tiers",
	ErrUnauthorizedHeader: "Missing or invalid Authorization header",
	ErrInvalidTokenClaims: "Invalid token payload",
	ErrRateLimitExceeded:  "Rate limit exceeded. Try again later.",
}
