const COMMANDS: &[&str] = &["share_file","get_shared_files","get_shared_files_path"];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .ios_path("ios")
    .build();
}
