use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct User {
    name: String,
    age: u32,
}

fn create_user(name: &str, age: u32) -> User {
    User {
        name: name.to_string(),
        age,
    }
}

fn main() {
    let user = create_user("Alice", 30);
    println!("User: {:?}", user);
}
