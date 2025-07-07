package dtos

import "github.com/google/uuid"

type JwtOrganization struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Role string    `json:"role"`
}

type CoolJwtPayload struct {
	UserID       uuid.UUID        `json:"userId"`
	Email        string           `json:"email"`
	Organization *JwtOrganization `json:"organization,omitempty"`
	JTI          string           `json:"jti,omitempty"`
	Exp          float64          `json:"exp,omitempty"` // hoặc int64 nếu bạn chắc
	Iat          float64          `json:"iat,omitempty"`
}
