//! Provider HTTP clients for agent model calls. Each provider exposes
//! the same `invoke()` shape so the runner's dispatch stays uniform.

pub mod anthropic;
pub mod openai;
