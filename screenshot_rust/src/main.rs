use chromiumoxide::browser::{Browser, BrowserConfig};
use chromiumoxide::cdp::browser_protocol::page::CaptureScreenshotParams;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs;
use clap::Parser;
use base64::{Engine as _, engine::general_purpose};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// URL to take screenshot of
    #[arg(short, long)]
    url: String,
    
    /// Output file path
    #[arg(short, long, default_value = "screenshot.png")]
    output: String,
    
    /// Width of the viewport
    #[arg(short, long, default_value = "1920")]
    width: u32,
    
    /// Height of the viewport
    #[arg(short, long, default_value = "1080")]
    height: u32,
    
    /// Take full page screenshot
    #[arg(short, long)]
    full_page: bool,
    
    /// Quality for JPEG (1-100)
    #[arg(short, long, default_value = "90")]
    quality: u8,
    
    /// Output format (png, jpeg)
    #[arg(short, long, default_value = "png")]
    format: String,
    
    /// Return base64 encoded data instead of saving to file
    #[arg(short, long)]
    base64: bool,
}

#[derive(Serialize, Deserialize)]
struct ScreenshotResult {
    success: bool,
    url: String,
    width: u32,
    height: u32,
    full_page: bool,
    format: String,
    quality: u8,
    size: usize,
    base64_data: Option<String>,
    file_path: Option<String>,
    error: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    
    let result = take_screenshot(&args).await;
    
    // Output result as JSON
    let json_result = serde_json::to_string_pretty(&result)?;
    println!("{}", json_result);
    
    Ok(())
}

async fn take_screenshot(args: &Args) -> ScreenshotResult {
    // Launch browser
    let (browser, mut handler) = match Browser::launch(
        BrowserConfig::builder()
            .build()
            .unwrap()
    ).await {
        Ok(result) => result,
        Err(e) => {
            return ScreenshotResult {
                success: false,
                url: args.url.clone(),
                width: args.width,
                height: args.height,
                full_page: args.full_page,
                format: args.format.clone(),
                quality: args.quality,
                size: 0,
                base64_data: None,
                file_path: None,
                error: Some(format!("Failed to launch browser: {}", e)),
            };
        }
    };

    // Spawn handler task
    tokio::task::spawn(async move {
        while let Some(h) = handler.next().await {
            if h.is_err() {
                break;
            }
        }
    });

    // Create new page
    let page = match browser.new_page("about:blank").await {
        Ok(page) => page,
        Err(e) => {
            return ScreenshotResult {
                success: false,
                url: args.url.clone(),
                width: args.width,
                height: args.height,
                full_page: args.full_page,
                format: args.format.clone(),
                quality: args.quality,
                size: 0,
                base64_data: None,
                file_path: None,
                error: Some(format!("Failed to create new page: {}", e)),
            };
        }
    };

    // Navigate to URL
    if let Err(e) = page.goto(&args.url).await {
        return ScreenshotResult {
            success: false,
            url: args.url.clone(),
            width: args.width,
            height: args.height,
            full_page: args.full_page,
            format: args.format.clone(),
            quality: args.quality,
            size: 0,
            base64_data: None,
            file_path: None,
            error: Some(format!("Failed to navigate to URL: {}", e)),
        };
    }

    // Wait for page to load
    if let Err(e) = page.wait_for_navigation().await {
        return ScreenshotResult {
            success: false,
            url: args.url.clone(),
            width: args.width,
            height: args.height,
            full_page: args.full_page,
            format: args.format.clone(),
            quality: args.quality,
            size: 0,
            base64_data: None,
            file_path: None,
            error: Some(format!("Failed to wait for navigation: {}", e)),
        };
    }

    // Wait a bit more for dynamic content to load
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    // Take screenshot
    let screenshot_params = CaptureScreenshotParams::builder()
        .format(match args.format.as_str() {
            "jpeg" | "jpg" => chromiumoxide::cdp::browser_protocol::page::CaptureScreenshotFormat::Jpeg,
            _ => chromiumoxide::cdp::browser_protocol::page::CaptureScreenshotFormat::Png,
        })
        .quality(if args.format == "jpeg" { args.quality as i64 } else { 90 })
        .capture_beyond_viewport(args.full_page)
        .build();

    let screenshot_data = match page.screenshot(screenshot_params).await {
        Ok(data) => data,
        Err(e) => {
            return ScreenshotResult {
                success: false,
                url: args.url.clone(),
                width: args.width,
                height: args.height,
                full_page: args.full_page,
                format: args.format.clone(),
                quality: args.quality,
                size: 0,
                base64_data: None,
                file_path: None,
                error: Some(format!("Failed to capture screenshot: {}", e)),
            };
        }
    };

    let size = screenshot_data.len();

    if args.base64 {
        // Return base64 encoded data
        let base64_data = general_purpose::STANDARD.encode(&screenshot_data);
        ScreenshotResult {
            success: true,
            url: args.url.clone(),
            width: args.width,
            height: args.height,
            full_page: args.full_page,
            format: args.format.clone(),
            quality: args.quality,
            size,
            base64_data: Some(base64_data),
            file_path: None,
            error: None,
        }
    } else {
        // Save to file
        if let Err(e) = fs::write(&args.output, &screenshot_data) {
            return ScreenshotResult {
                success: false,
                url: args.url.clone(),
                width: args.width,
                height: args.height,
                full_page: args.full_page,
                format: args.format.clone(),
                quality: args.quality,
                size,
                base64_data: None,
                file_path: None,
                error: Some(format!("Failed to save screenshot to file: {}", e)),
            };
        }

        ScreenshotResult {
            success: true,
            url: args.url.clone(),
            width: args.width,
            height: args.height,
            full_page: args.full_page,
            format: args.format.clone(),
            quality: args.quality,
            size,
            base64_data: None,
            file_path: Some(args.output.clone()),
            error: None,
        }
    }
}