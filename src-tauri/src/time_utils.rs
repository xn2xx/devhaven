use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::SwiftDate;

const APPLE_REFERENCE_EPOCH: i64 = 978_307_200;

/// 获取当前时间的 Swift 时间戳。
pub fn now_swift() -> SwiftDate {
    unix_to_swift(system_time_to_unix(SystemTime::now()))
}

/// 将系统时间转换为 Swift 时间戳。
pub fn system_time_to_swift(time: SystemTime) -> SwiftDate {
    unix_to_swift(system_time_to_unix(time))
}

/// 将 Unix 秒数转换为 Swift 时间戳。
pub fn unix_to_swift(unix_seconds: f64) -> SwiftDate {
    unix_seconds - APPLE_REFERENCE_EPOCH as f64
}

/// 将系统时间转换为 Unix 秒数。
pub fn system_time_to_unix_seconds(time: SystemTime) -> f64 {
    system_time_to_unix(time)
}

// 将系统时间统一转为 Unix 秒数。
fn system_time_to_unix(time: SystemTime) -> f64 {
    match time.duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_secs_f64(),
        Err(_) => 0.0,
    }
}
