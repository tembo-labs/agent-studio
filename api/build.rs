// `sqlx::migrate!("./migrations")` embeds the migration files into the
// binary at compile time. Without this, adding a migration doesn't touch
// any .rs source, so cargo's incremental cache skips recompiling and the
// new migration is silently left out of the build (it never runs on
// boot). Telling cargo to re-evaluate when the migrations dir changes
// forces the macro to re-embed.
fn main() {
    println!("cargo:rerun-if-changed=migrations");
}
