pub mod report;
// test-infrastructure hook: declares the admin model module so that
// backend/src/models/admin.rs is compiled and its #[cfg(test)] suite is
// discovered by `cargo test`. This line carries no behavioral side effects —
// it is a module path declaration only. The impl-engineer will keep this line
// when they fill in the admin.rs structs.
pub mod admin;
pub mod ward;
pub mod organization;
