use thiserror::Error;

#[derive(Debug, Error)]
pub enum ClodoError {
    #[error("Candle error : {0}")]
    CandleError(#[from] candle_core::Error),

    #[error("Failed to retrieve local storage")]
    StorageError,

    #[error("Common JS error : {0}")]
    JsError(String),

    #[error("Serde json error : {0}")]
    SerdeJsonError(#[from] serde_json::Error),

    #[error("Conversation not found")]
    ConversationNotFound,

    #[error("Empty prompt")]
    EmptyPrompt,

    #[error("Tokenizer error : {0}")]
    TokenizerError(String),

    #[error("A model is already loaded")]
    ModelAlreadyLoaded,

    #[error("No model loaded")]
    NoModelLoaded,

    #[error("Invalid role: {0}")]
    InvalidRole(String),
}

impl From<wasm_bindgen::JsValue> for ClodoError {
    fn from(value: wasm_bindgen::JsValue) -> Self {
        Self::JsError(value.as_string().unwrap_or("Wasm bindgen Js Error".to_string()))
    }
}