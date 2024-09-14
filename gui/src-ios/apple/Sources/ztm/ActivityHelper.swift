import Foundation
import UIKit
import ActivityKit
import UserNotifications
import WidgetKit
import SwiftUI

struct AdventureAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var progress: Double
        var message: String
        let currentHealthLevel: Double
        let eventDescription: String
    }
    
}

struct AdventureLiveActivityView: View {
    var hero: String
    var isStale: Bool
    var contentState: AdventureAttributes.ContentState
    
    var body: some View {
        // Define your Live Activity View
        Text("Hero: \(hero), Progress: \(Int(contentState.progress * 100))%")
    }
}

struct AdventureActivityConfiguration: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AdventureAttributes.self) { context in
            AdventureLiveActivityView(
                hero: "ztm",
                isStale: context.isStale,
                contentState: context.state
            )
            .activityBackgroundTint(Color.gray.opacity(0.25))
        } dynamicIsland: { context in
            // Create the presentations that appear in the Dynamic Island.
            DynamicIsland {
                // Dynamic Island expanded view (full screen)
                DynamicIslandExpandedRegion(.leading) {
                    HStack {
                        Image(systemName: "star.fill") // Replace with your icon
                            .resizable()
                            .frame(width: 24, height: 24)
                        Text("ztm running")
                            .font(.headline)
                    }
                }
                
                DynamicIslandExpandedRegion(.trailing) {
                    HStack {
                        Text("\(Int(context.state.progress * 100))%")
                            .font(.subheadline)
                    }
                }
                
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text("ztm running")
                            .font(.body)
                    }
                }
            } compactLeading: {
                HStack {
                    Image(systemName: "star.fill") // Replace with your icon
                        .resizable()
                        .frame(width: 20, height: 20)
                }
            } compactTrailing: {
                HStack {
                    Text("\(Int(context.state.progress * 100))%")
                        .font(.subheadline)
                }
            } minimal: {
                HStack {
                    Image(systemName: "star.fill") // Replace with your icon
                        .resizable()
                        .frame(width: 20, height: 20)
                }
            }
        }
    }
}
///=====
struct MyActivityAttributes: ActivityAttributes {
    
    // 定义一个嵌套的结构体来表示活动的内容状态
    struct ContentState: Codable, Hashable {
        var progress: Double
        var message: String
        let currentHealthLevel: Double
        let eventDescription: String
    }
    
}



@objc class ActivityHelper: NSObject {
    
    static var activity: Activity<AdventureAttributes>? // 保存活动的引用
    static var timer: Timer? // 保存计时器
    
    
    
    // 更新实时活动的内容
    @objc static func updateLiveActivity() {
        guard let activity = self.activity else {
            NSLog("调试-未找到正在进行的实时活动")
            return
        }
        
        // 生成随机进度和文案
        let newProgress = Double.random(in: 0.0...1.0)
        let newMessage = "ZTM runnning in backend"
        
        let updatedContent = ActivityContent(
            state: AdventureAttributes.ContentState(progress: newProgress, message: newMessage,currentHealthLevel:0,eventDescription:newMessage),
            staleDate: Date().addingTimeInterval(3600) // 保持1小时过期时间
        )
        
        Task {
            do {
                try await activity.update(updatedContent)
                NSLog("调试-实时活动已更新")
            } catch {
                NSLog("调试-更新实时活动失败: \(error.localizedDescription)")
            }
        }
    }
    // 启动计时器，每10秒更新一次锁屏内容
    @objc static func startTimer() {
        self.timer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { _ in
            self.updateLiveActivity()
        }
    }
    
    // 结束实时活动并停止计时器
    @objc static func endLiveActivity() {
        guard let activity = self.activity else {
            NSLog("调试-未找到正在进行的实时活动")
            return
        }
        
        Task {
            await activity.end(dismissalPolicy: .immediate)
            NSLog("调试-实时活动已结束")
            
            // 停止定时器
            self.timer?.invalidate()
            self.timer = nil
        }
    }
    
    @objc static func startLiveActivityWithID(_ activityID: String) {
        NSLog("调试-areActivitiesEnabled before")
        
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if granted {
                NSLog("调试-通知权限已授予")
                UNUserNotificationCenter.current().getNotificationSettings { settings in
                    if settings.authorizationStatus == .authorized {
                        NSLog("调试-通知权限已授予 Settings")
                    } else {
                        NSLog("调试-通知权限未授予，可能导致实时活动启动失败 Settings")
                    }
                }
                UIApplication.shared.registerForRemoteNotifications()
                
                if ActivityAuthorizationInfo().areActivitiesEnabled {
                    NSLog("调试-areActivitiesEnabled after")
                    
                    let activityContent = AdventureAttributes.ContentState(progress: 0.0, message: "ZTM running in backend",currentHealthLevel:0,eventDescription:"ZTM running in backend")
                    let initialContent = ActivityContent(state: activityContent, staleDate: Date().addingTimeInterval(3600))
                    
                    NSLog("调试-areActivitiesEnabled do")
                    do {
                        let activity = try Activity<AdventureAttributes>.request(attributes: AdventureAttributes(), content: initialContent)
                        NSLog("调试-实时活动已启动，ID: \(activity.id)")
                        
                        // 保存活动的引用
                        self.activity = activity
                        
                        // 启动定时器，每10秒更新一次文案
                        self.startTimer()
                        
                    } catch {
                        NSLog("调试-启动实时活动失败: \(error.localizedDescription)")
                    }
                }
                
            } else {
                NSLog("调试-通知权限被拒绝")
            }
        }
    }
}
