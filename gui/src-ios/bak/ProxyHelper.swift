import Foundation
import UIKit
import ActivityKit
import UserNotifications
import WidgetKit
import SwiftUI
import BackgroundTasks
import NetworkExtension

///=====

@objc class ProxyHelper: NSObject {
    
    @objc static func initProxy() {
        NSLog("调试-initProxy before!")
        NEAppProxyProviderManager.loadAllFromPreferences { managers, error in
            if let error = error {
                NSLog("调试-Failed to load preferences: \(error.localizedDescription)")
                return
            }
            
            NSLog("调试-initProxy managers?.first end!")
            if let manager = managers?.first {
                // 使用现有的配置文件启动 Proxy
                NSLog("调试-initProxy managers?.first in!")
                do {
                    try manager.connection.startVPNTunnel()
                    NSLog("调试-Proxy Tunnel started successfully!")
                } catch let startError {
                    NSLog("调试-Failed to start Proxy Tunnel: \(startError.localizedDescription)")
                }
            } else {
                // 创建新的 Proxy 配置
                NSLog("调试-initProxy config")
                let manager = NEAppProxyProviderManager()
                
                // 保存配置
                
                NSLog("调试-saveToPreferences before")
                // 配置代理相关设置
                let configuration = NETunnelProviderProtocol()
                configuration.providerBundleIdentifier = "com.yourapp.proxyextension" // 指向你的 App Proxy 扩展的 Bundle Identifier
                configuration.serverAddress = "proxy.yourapp.com" // 设置你自己的服务器地址
                configuration.disconnectOnSleep = false
								manager.protocolConfiguration = configuration
                manager.localizedDescription = "Ztm App Proxy"
                manager.isEnabled = true
                // 继续保存新配置
                manager.saveToPreferences { error in
                    if let error = error {
                        NSLog("调试1-Failed to save preferences: \(error.localizedDescription)")
                        return
                    }
                    
                    NSLog("调试1-startProxyTunnel before")
                    // 配置保存后，启动 Proxy
                    do {
                        try manager.connection.startVPNTunnel()
                        NSLog("调试1-Proxy Tunnel started successfully after saving!")
                    } catch let startError {
                        NSLog("调试1-Failed to start Proxy Tunnel: \(startError.localizedDescription)")
                    }
                }
            }
        }
    }
}
