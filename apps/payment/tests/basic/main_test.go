package basic

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAddOne(t *testing.T) {
	// var (
	// 	input  = 1
	// 	output = 3
	// )
	// actual := AddOne(1)
	// if actual != output {
	// 	t.Errorf("AddOne (%d), input %d, actual %d", input, output, actual)
	// }
	assert.Equal(t, AddOne(2), 3, "AddOne(2) should be 3")
	assert.NotEqual(t, 2, 3)
	assert.Nil(t, nil, nil)
}

func TestRequire(t *testing.T) {
	require.Equal(t, 2, 3) // with require, any command after it won't be excecuted if test fail
	fmt.Println("lll")
}

func TestAddOne2(t *testing.T) {
	var (
		input  = 1
		output = 2
	)

	actual := AddOne2(1)
	if actual != output {
		t.Errorf("AddOne (%d), input %d, actual %d", input, output, actual)
	}
}
