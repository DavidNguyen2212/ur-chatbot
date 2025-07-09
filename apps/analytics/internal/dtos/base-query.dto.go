package dtos

type BaseQuery struct {
	Ordering string `query:"ordering"`
	Page     int32  `query:"page"`
	PageSize int32  `query:"page_size"`
}

func (b *BaseQuery) SetDefaults(defaultOrdering string) {
	if b.Ordering == "" {
		b.Ordering = defaultOrdering
	}
	if b.Page == 0 {
		b.Page = 1
	}
	if b.PageSize == 0 {
		b.PageSize = 20
	}
}
