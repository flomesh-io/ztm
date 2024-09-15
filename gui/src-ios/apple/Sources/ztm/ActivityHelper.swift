import Foundation
import UIKit
import ActivityKit
import UserNotifications
import WidgetKit
import SwiftUI
import BackgroundTasks
///=====

// 声明 C 函数
@_silgen_name("pipy_main") func pipy_main(argc: Int32, argv: UnsafeMutablePointer<UnsafeMutablePointer<Int8>?>) -> Int32

@objc class ActivityHelper: NSObject, URLSessionDelegate {
    
    static var activity: Activity<RunnerWidgetAttributes>? // 保存活动的引用
    static var timer: Timer? // 保存计时器
    
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        NSLog("下载完成，文件位置: \(location.path)")
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            NSLog("下载失败，错误信息: \(error.localizedDescription)")
        } else {
            NSLog("下载任务已成功完成")
        }
    }
    
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        let progress = Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)
        NSLog("下载进度: \(progress * 100)%")
    }
    @objc static func playPipy() {
        // Get the document directory path
        var bgTask: UIBackgroundTaskIdentifier = .invalid
        bgTask = UIApplication.shared.beginBackgroundTask {
            // 当后台任务即将过期时调用
            UIApplication.shared.endBackgroundTask(bgTask)
            bgTask = .invalid
        }
        DispatchQueue.global(qos: .default).async {
            for progress in stride(from: 0.0, to: 100.0, by: 1.0) {
                let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
                guard let documentDirectory = paths.first else {
                    NSLog("调试-Could not find document directory")
                    return
                }
                
                let ztmdbPath = documentDirectory.appendingPathComponent("ztmdb").path
                let ztmlogPath = documentDirectory.appendingPathComponent("log.txt").path
                NSLog("调试-libpipy documentDirectory is \(documentDirectory.path)")
                
                // Create the argument list
                var args = ["--pipy", "repo://ztm/agent", "--args", "--data", ztmdbPath, "--listen", "7777", "--pipy-options", "--log-file=\(ztmlogPath)"]
                
                let cArgs = args.map { strdup($0) }
                defer { cArgs.forEach { free($0) } }  // 确保释放内存
                
                // 创建 UnsafeMutablePointer 数组
                let argv = UnsafeMutablePointer<UnsafeMutablePointer<Int8>?>.allocate(capacity: cArgs.count)
                for (index, arg) in cArgs.enumerated() {
                    argv[index] = arg
                }
                argv[cArgs.count] = nil // 添加 null 终止符
                
                // Call the pipy_main function
                let result = pipy_main(argc: Int32(cArgs.count), argv: argv)
                
                // Log the result
                NSLog("调试-callPipyMain pipy_main returned: \(result)")
            }
            UIApplication.shared.endBackgroundTask(bgTask)
        };
    }

    @objc static func scheduleBackgroundTask() {
        let request = BGProcessingTaskRequest(identifier: "com.flomesh.ztm.pipy")
        request.requiresNetworkConnectivity = true  // 需要网络连接
        request.requiresExternalPower = false       // 不需要外部电源

        do {
            try BGTaskScheduler.shared.submit(request)
            NSLog("调试-后台处理任务提交成功")
        } catch {
            NSLog("提交后台处理任务失败: \(error)")
        }
    }
    @objc static func handleBackgroundTask(_ task: BGProcessingTask) {
        // 确保后台任务不会被立即挂起
        task.expirationHandler = {
            // 任务到期时调用
            task.setTaskCompleted(success: false)
            scheduleBackgroundTask()  // 重新调度任务
        }
        
        // 启动 Pipy
        playPipy()
        
        // 完成任务后调用
        task.setTaskCompleted(success: true)
    }
    @objc static func startBackgroundDownload() {
        let config = URLSessionConfiguration.background(withIdentifier: "com.flomesh.ztm.download")
        
        // 设置超时时间（默认是 60 秒），可以延长到例如 5 分钟
        config.timeoutIntervalForResource = 3600 // 300 秒即 5 分钟
        NSLog("调试-下载中");
        let session = URLSession(configuration: config, delegate: ActivityHelper(), delegateQueue: nil)
        
        // 创建一个假的下载任务
        if let url = URL(string: "https://example.com/fakefile") {
            let downloadTask = session.downloadTask(with: url)
            downloadTask.resume();
            
        }
    }
    // 应用启动时调用
    @objc static func applicationDidFinishLaunchingWithOptions() {
        
        self.playPipy();   // 启动 Pipy
        self.scheduleBackgroundTask();
    }
    // 更新实时活动的内容
    @objc static func updateLiveActivity() {
        guard let activity = self.activity else {
            NSLog("调试-未找到正在进行的实时活动")
            return
        }
        
        let attributes = RunnerWidgetAttributes(name: "Example")
        let initialContentState = RunnerWidgetAttributes.ContentState()
        let updatedContent = ActivityContent(
            state: initialContentState,
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
        DispatchQueue.main.async {
            NSLog("调试-注册更新实时活动 DispatchQueue")
            self.timer = Timer.scheduledTimer(withTimeInterval: 7.0, repeats: true) { _ in
                self.updateLiveActivity();
                self.playPipy();   // 启动 Pipy
                self.scheduleBackgroundTask();
//                self.startBackgroundDownload();
            }
        }
    }
    
    
    @objc static func watchEvent() {
        // 监听应用程序从后台切换到前台的事件
        NotificationCenter.default.addObserver(self, selector: #selector(handleAppOpen), name: UIApplication.willEnterForegroundNotification, object: nil)
        
        // 监听应用冷启动
        NotificationCenter.default.addObserver(self, selector: #selector(handleAppLaunch), name: UIApplication.didFinishLaunchingNotification, object: nil)
        
    }

    @objc static func handleAppOpen() {
        self.playPipy();
        self.startBackgroundDownload();
    }

    @objc static func handleAppLaunch() {
        self.playPipy();
        self.startBackgroundDownload();
    }
    @objc static func startLiveActivity() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if granted {
                
                UNUserNotificationCenter.current().getNotificationSettings { settings in
                    if settings.authorizationStatus == .authorized {
                        NSLog("调试-通知权限已授予 Settings")
                    } else {
                        NSLog("调试-通知权限未授予，可能导致实时活动启动失败 Settings")
                    }
                }
                if ActivityAuthorizationInfo().areActivitiesEnabled {
                    NSLog("调试-Live Activity Start")
                    let attributes = RunnerWidgetAttributes(name: "Example")
                    let initialContentState = RunnerWidgetAttributes.ContentState()
                    let initialContent = ActivityContent(state: initialContentState, staleDate: Date().addingTimeInterval(3600))
                    
                    do {
                        NSLog("调试-Live Activity Start2")
                        let activity = try Activity<RunnerWidgetAttributes>.request(
                            attributes: attributes,
                            content: initialContent
//                            pushType: .token
//                            nil
                        )
                        self.activity = activity;
//                        let liveActivityObserver: Task = AppDelegate.braze?.liveActivities.launchActivity(pushTokenTag: "sports-game-2024-03-15",activity: activity)
//                        self.startTimer();
                        NSLog("调试-Live Activity END")
                    } catch {
                        NSLog("调试-Failed to start Live Activity: \(error.localizedDescription)")
                    }
                }
            } else {
                NSLog("调试-通知权限被拒绝")
            }
        }
    }
}
@objc class WidgetHelper: NSObject {
    @objc static func reloadWidgets() {
        if #available(iOS 16.1, *) {
            NSLog("调试-Widget timelines before")
//            let widget = AdventureActivityConfiguration();
            WidgetCenter.shared.reloadAllTimelines()
            WidgetCenter.shared.reloadTimelines(ofKind: "RunnerWidgetAttributes")
            NSLog("调试-Widget timelines reloaded")
        } else {
            NSLog("调试-iOS version is too low to reload widgets")
        }
    }
}

