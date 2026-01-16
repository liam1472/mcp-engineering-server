/**
 * C++ function samples for testing function indexer
 */

#include <string>
#include <vector>
#include <memory>
#include <functional>

// Regular function
int calculateSum(int a, int b) {
    return a + b;
}

// Template function
template<typename T>
T multiply(T x, T y) {
    return x * y;
}

// Generic identity function
template<typename T>
T identity(T arg) {
    return arg;
}

// User class
class User {
private:
    std::string name;
    int age;
    std::string email;

public:
    User(const std::string& name, int age)
        : name(name), age(age) {}

    std::string getDisplayName() const {
        return name + " (" + std::to_string(age) + ")";
    }

    void setEmail(const std::string& email) {
        this->email = email;
    }

    const std::string& getName() const { return name; }
    int getAge() const { return age; }
};

// Calculator class
class Calculator {
private:
    double value;

public:
    explicit Calculator(double initial = 0) : value(initial) {}

    Calculator& add(double n) {
        value += n;
        return *this;
    }

    Calculator& subtract(double n) {
        value -= n;
        return *this;
    }

    double getValue() const {
        return value;
    }

    static std::unique_ptr<Calculator> create(double initial) {
        return std::make_unique<Calculator>(initial);
    }
};

// Template class
template<typename T>
class DataProcessor {
public:
    virtual T process(T data) = 0;
    virtual bool validate(const T& data) = 0;
    virtual ~DataProcessor() = default;
};

// Process items with callback
template<typename T>
std::vector<T> processItems(
    const std::vector<T>& items,
    std::function<T(T)> callback
) {
    std::vector<T> result;
    result.reserve(items.size());
    for (const auto& item : items) {
        result.push_back(callback(item));
    }
    return result;
}
