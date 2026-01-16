/**
 * C function samples for testing function indexer
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Calculate sum of two numbers */
int calculate_sum(int a, int b) {
    return a + b;
}

/* Multiply two numbers */
double multiply(double x, double y) {
    return x * y;
}

/* User structure */
typedef struct {
    char name[100];
    int age;
    char email[200];
} User;

/* Create a new user */
User* create_user(const char* name, int age) {
    User* user = (User*)malloc(sizeof(User));
    if (user) {
        strncpy(user->name, name, sizeof(user->name) - 1);
        user->name[sizeof(user->name) - 1] = '\0';
        user->age = age;
        user->email[0] = '\0';
    }
    return user;
}

/* Free user memory */
void free_user(User* user) {
    if (user) {
        free(user);
    }
}

/* Get display name */
void get_display_name(const User* user, char* buffer, size_t size) {
    if (user && buffer) {
        snprintf(buffer, size, "%s (%d)", user->name, user->age);
    }
}

/* Calculator structure */
typedef struct {
    double value;
} Calculator;

/* Create calculator */
Calculator* calculator_create(double initial) {
    Calculator* calc = (Calculator*)malloc(sizeof(Calculator));
    if (calc) {
        calc->value = initial;
    }
    return calc;
}

/* Add to calculator */
void calculator_add(Calculator* calc, double n) {
    if (calc) {
        calc->value += n;
    }
}

/* Subtract from calculator */
void calculator_subtract(Calculator* calc, double n) {
    if (calc) {
        calc->value -= n;
    }
}

/* Get calculator value */
double calculator_get_value(const Calculator* calc) {
    return calc ? calc->value : 0.0;
}

/* Free calculator */
void calculator_free(Calculator* calc) {
    if (calc) {
        free(calc);
    }
}

/* Process array with callback */
void process_array(int* arr, size_t size, int (*callback)(int)) {
    for (size_t i = 0; i < size; i++) {
        arr[i] = callback(arr[i]);
    }
}
