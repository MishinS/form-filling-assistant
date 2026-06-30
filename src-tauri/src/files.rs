use std::path::{Path, PathBuf};

/// Reduce an arbitrary string to a safe basename: strip any directory
/// components and traversal so a caller can never escape the target dir.
pub fn sanitize_basename(name: &str) -> String {
    Path::new(name)
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .filter(|s| !s.is_empty() && s != "." && s != "..")
        .unwrap_or_else(|| "download.xlsx".to_string())
}

/// Write bytes into `dir/<sanitised filename>`; return the full written path.
pub fn write_file(dir: &Path, filename: &str, bytes: &[u8]) -> Result<String, String> {
    let safe = sanitize_basename(filename);
    let target = dir.join(safe);
    std::fs::write(&target, bytes).map_err(|_| "write_failed".to_string())?;
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn pick_directory() -> Option<String> {
    rfd::AsyncFileDialog::new()
        .pick_folder()
        .await
        .map(|h| h.path().to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn save_file(
    app: tauri::AppHandle,
    dir: String,
    filename: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    use tauri::Manager;
    let base: PathBuf = if dir.trim().is_empty() {
        app.path().download_dir().map_err(|_| "no_downloads_dir".to_string())?
    } else {
        PathBuf::from(dir)
    };
    write_file(&base, &filename, &bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_dir() -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let d = std::env::temp_dir().join(format!("ffa_save_test_{nanos}"));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn write_file_writes_bytes_and_returns_path() {
        let dir = tmp_dir();
        let path = write_file(&dir, "out.xlsx", b"hello").unwrap();
        assert!(path.ends_with("out.xlsx"));
        assert_eq!(std::fs::read(&path).unwrap(), b"hello");
    }

    #[test]
    fn write_file_sanitises_path_separators() {
        let dir = tmp_dir();
        let path = write_file(&dir, "../../etc/passwd", b"x").unwrap();
        assert!(path.ends_with("passwd"));
        assert!(!path.contains(".."));
        assert!(Path::new(&path).starts_with(&dir));
    }

    #[test]
    fn sanitize_basename_falls_back_on_empty() {
        assert_eq!(sanitize_basename(""), "download.xlsx");
        assert_eq!(sanitize_basename("/"), "download.xlsx");
    }
}
