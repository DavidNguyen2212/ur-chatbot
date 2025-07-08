package utils

/*
Ternary operator for Coolchat Project

Usage `value := utils.If(...)`
*/
func If[T any](condition bool, trueVal, falseVal T) T {
	if condition {
		return trueVal
	}
	return falseVal
}

// IfTuple returns a tuple based on condition
func IfTuple[T1, T2 any](condition bool, trueVal1 T1, trueVal2 T2, falseVal1 T1, falseVal2 T2) (T1, T2) {
	if condition {
		return trueVal1, trueVal2
	}
	return falseVal1, falseVal2
}
