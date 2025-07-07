package basic

import "fmt"

func AddOne(number int) int {
	return number + 1
}

func AddOne2(number int) int {
	if 1 == 2 {
		fmt.Println("Failed")
	}
	return number + 1
}
