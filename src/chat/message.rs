use serde::{Serialize, Deserialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Message {
    role: String,
    content: String,
}

impl Message {
    pub fn new(role: &str, content: &str) -> Self {
        Self { 
            role: role.to_string(), 
            content: content.to_string() 
        }
    }

    pub fn role_as_ref(&self) -> &str {
        &self.role
    }

    pub fn content_as_ref(&self) -> &str {
        &self.content
    }
}

// Rust-only convenience constructors (wasm_bindgen doesn't support impl Into<String>)
impl Message {
    /// Create a system message
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: "system".to_string(),
            content: content.into(),
        }
    }

    /// Create a user message
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: "user".to_string(),
            content: content.into(),
        }
    }

    /// Create an assistant message
    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: "assistant".to_string(),
            content: content.into(),
        }
    }
}