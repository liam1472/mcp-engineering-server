package samples

import (
	"fmt"
	"net/http"
)

// CalculateSum adds two integers
func CalculateSum(a, b int) int {
	return a + b
}

// Multiply multiplies two floats
func Multiply(x, y float64) float64 {
	return x * y
}

// FetchData fetches data from a URL
func FetchData(url string) (*http.Response, error) {
	return http.Get(url)
}

// User represents a user entity
type User struct {
	Name  string
	Age   int
	Email string
}

// NewUser creates a new user
func NewUser(name string, age int) *User {
	return &User{
		Name: name,
		Age:  age,
	}
}

// GetDisplayName returns formatted display name
func (u *User) GetDisplayName() string {
	return fmt.Sprintf("%s (%d)", u.Name, u.Age)
}

// Calculator performs arithmetic operations
type Calculator struct {
	value float64
}

// NewCalculator creates a new calculator
func NewCalculator(initial float64) *Calculator {
	return &Calculator{value: initial}
}

// Add adds a number to the current value
func (c *Calculator) Add(n float64) *Calculator {
	c.value += n
	return c
}

// Subtract subtracts a number from current value
func (c *Calculator) Subtract(n float64) *Calculator {
	c.value -= n
	return c
}

// GetValue returns the current value
func (c *Calculator) GetValue() float64 {
	return c.value
}

// ProcessItems processes items with a callback
func ProcessItems[T any](items []T, callback func(T) T) []T {
	result := make([]T, len(items))
	for i, item := range items {
		result[i] = callback(item)
	}
	return result
}
