//
//  ShareViewController.swift
//  ShareExtension
//
//  Created by 林东臣 on 2024/11/9.
//

import UIKit
import Social

class ShareViewController: SLComposeServiceViewController {

    override func isContentValid() -> Bool {
        // Do validation of contentText and/or NSExtensionContext attachments here
        return true
    }

    override func didSelectPost() {
        NSLog("didSelectPost()")
        // This is called after the user selects Post. Do the upload of contentText and/or NSExtensionContext attachments.
    
        // Inform the host that we're done, so it un-blocks its UI. Note: Alternatively you could call super's -didSelectPost, which will similarly complete the extension context.
        self.extensionContext!.completeRequest(returningItems: [], completionHandler: nil)
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        NSLog("viewDidLoad()")
        // 获取扩展接收的分享数据
        if let item = extensionContext?.inputItems.first as? NSExtensionItem,
           let attachment = item.attachments?.first {
            
            // 加载并处理文件内容
            attachment.loadItem(forTypeIdentifier: "public.data", options: nil) { (data, error) in
                if let fileURL = data as? URL {
                    self.saveFileToAppDirectory(fileURL)
                } else {
                    NSLog("Error: Unable to get file URL")
                }
            }
        }
    }
    
    // 将文件写入主应用私有的文档目录 /temp 文件夹
    private func saveFileToAppDirectory(_ fileURL: URL) {
        NSLog("saveFileToAppDirectory()")
        
        // 使用 App Group 共享目录
        guard let sharedContainerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.flomesh.ztm") else {
            NSLog("Error: Unable to access App Group container")
            return
        }
        
        // 拼接 temp 目录（如果需要）
        let destinationDirectory = sharedContainerURL.appendingPathComponent("temp")
        
        // 确保目录存在
        try? FileManager.default.createDirectory(at: destinationDirectory, withIntermediateDirectories: true, attributes: nil)
        
        // 拼接目标文件路径
        let destinationURL = destinationDirectory.appendingPathComponent(fileURL.lastPathComponent)
        
        // 复制文件到目标路径
        do {
            try FileManager.default.copyItem(at: fileURL, to: destinationURL)
            NSLog("File successfully saved to \(destinationURL.path)")
        } catch {
            NSLog("Error: Unable to save file - \(error.localizedDescription)")
        }
        
				// 使用以下代码打开主应用
				if let url = URL(string: "ztm://") {
				    var responder = self as UIResponder?
				    while responder != nil {
				        if let application = responder as? UIApplication {
				            application.perform(#selector(UIApplication.openURL(_:)), with: url)
				            break
				        }
				        responder = responder?.next
				    }
				}
				
				//done
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
    
    override func configurationItems() -> [Any]! {
        // To add configuration options via table cells at the bottom of the sheet, return an array of SLComposeSheetConfigurationItem here.
        return []
    }

}
