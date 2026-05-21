#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Simple JSON parser for {"a": X, "b": Y}
void parse_json(const char* json, double* a, double* b) {
    sscanf(json, "{\"a\": %lf, \"b\": %lf}", a, b);
}

int add_int(int a, int b) {
    return a + b;
}

double add_double(double a, double b) {
    return a + b;
}

// Main entry point - Wazero calls _start which invokes main()
int main() {
    const char* args = getenv("WASM_ARGS");
    if (!args) {
        printf("Error: No WASM_ARGS provided\n");
        return 1;
    }

    double a = 0.0, b = 0.0;
    parse_json(args, &a, &b);
    double result = add_double(a, b);
    
    // Format output based on whether it's an integer or float
    if (result == (long long)result) {
        printf("%lld\n", (long long)result);
    } else {
        printf("%.10g\n", result);
    }
    return 0;
}
