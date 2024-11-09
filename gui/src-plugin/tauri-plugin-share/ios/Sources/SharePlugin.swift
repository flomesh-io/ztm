import SwiftRs
import Tauri
import UIKit
import WebKit

class ShareArgs: Decodable {
  let path: String
  let mimeType: String?
}

class SharePlugin: Plugin {

	private func getPath(fileURL: String) -> String? {
			// Remove "/private" prefix if it exists
			var filePath = "";
			if fileURL.hasPrefix("/private") {
				filePath = fileURL.replacingOccurrences(of: "/private", with: "")
			} else {
				filePath = fileURL;
			}
			
			
			let homeDirectory = NSHomeDirectory();
			// Replace sandbox path with relative path
			var relativePath = filePath.replacingOccurrences(of: homeDirectory, with: "")
			if relativePath.hasPrefix("/") {
					relativePath = String(relativePath.dropFirst())
			}
			
			let path = URL(fileURLWithPath: homeDirectory).appendingPathComponent(relativePath).path
			
			NSLog("[shareFile]: Relative Path \(path)")
			
			// Check if the file exists
			if !FileManager.default.fileExists(atPath: path) {
					NSLog("[shareFile]: File does not exist \(path)")
					return nil
			}
			
			return path
	}
	private func shareFile(fileURL: String) {
			
			DispatchQueue.main.async {
					
					// Prepare content for sharing
					var activityItems = [Any]()
					
					if let path = self.getPath(fileURL: fileURL) {
						let relativeURL = URL(fileURLWithPath: path)
						activityItems.append(relativeURL)
					} else {
						NSLog("[shareFile]: Error: Unable to resolve path for file.")
						return
					}
					
					// Initialize UIActivityViewController
					let activityVC = UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
					
					// Present the activity view controller
					if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
					   let rootVC = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController {
						rootVC.present(activityVC, animated: true, completion: nil)
					} else {
						NSLog("[shareFile]: Error: rootVC is nil")
					}
			}
	}
  @objc public func share(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(ShareArgs.self)
    // invoke.resolve(["value": args.value ?? ""])
		self.shareFile(fileURL: args.path)
		NSLog("[shareFile]: \(args.path)")
		invoke.resolve(true)
  }
}

@_cdecl("init_plugin_share")
func initPlugin() -> Plugin {
  return SharePlugin()
}
