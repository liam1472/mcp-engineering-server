/// Rust function samples for testing function indexer

/// Calculate sum of two numbers
pub fn calculate_sum(a: i32, b: i32) -> i32 {
    a + b
}

/// Multiply two numbers
pub fn multiply(x: f64, y: f64) -> f64 {
    x * y
}

/// Async function to fetch data
pub async fn fetch_data(url: &str) -> Result<String, reqwest::Error> {
    let response = reqwest::get(url).await?;
    response.text().await
}

/// Generic identity function
pub fn identity<T>(arg: T) -> T {
    arg
}

/// User struct
#[derive(Debug, Clone)]
pub struct User {
    pub name: String,
    pub age: u32,
    pub email: Option<String>,
}

impl User {
    /// Create a new user
    pub fn new(name: &str, age: u32) -> Self {
        Self {
            name: name.to_string(),
            age,
            email: None,
        }
    }

    /// Get display name
    pub fn get_display_name(&self) -> String {
        format!("{} ({})", self.name, self.age)
    }

    /// Set email
    pub fn with_email(mut self, email: &str) -> Self {
        self.email = Some(email.to_string());
        self
    }
}

/// Calculator for arithmetic operations
pub struct Calculator {
    value: f64,
}

impl Calculator {
    /// Create a new calculator
    pub fn new(initial: f64) -> Self {
        Self { value: initial }
    }

    /// Add a number
    pub fn add(&mut self, n: f64) -> &mut Self {
        self.value += n;
        self
    }

    /// Subtract a number
    pub fn subtract(&mut self, n: f64) -> &mut Self {
        self.value -= n;
        self
    }

    /// Get current value
    pub fn get_value(&self) -> f64 {
        self.value
    }
}

/// Process items with a callback
pub fn process_items<T, F>(items: Vec<T>, callback: F) -> Vec<T>
where
    F: Fn(T) -> T,
{
    items.into_iter().map(callback).collect()
}

/// Trait for data processing
pub trait DataProcessor<T> {
    fn process(&self, data: T) -> T;
    fn validate(&self, data: &T) -> bool;
}
