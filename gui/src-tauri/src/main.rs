#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use fix_path_env::fix;

fn main() {
	if let Err(e) = fix() {
		println!("{}", e);
	} else {
		println!("PATH: {}", std::env::var("PATH").unwrap());
	}
	ztm_lib::run();
}
