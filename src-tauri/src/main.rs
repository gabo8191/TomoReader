// En release, evita abrir una consola adicional en Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tomo_lib::run();
}
