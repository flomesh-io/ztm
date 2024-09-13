import Foundation
import ActivityKit

@available(iOS 16.1, *)
struct CustomAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var message: String
    }

    var title: String
}

@available(iOS 16.1, *)
@objc class LiveActivityManager: NSObject {
    // 定义 shared 为静态方法
    @objc static func shared() -> LiveActivityManager {
        return LiveActivityManager()
    }

    @objc func startLiveActivity() {
        let attributes = CustomAttributes(title: "Live Activity Example")
        let initialContentState = CustomAttributes.ContentState(message: "Initializing")

        do {
            let activity = try Activity<CustomAttributes>.request(
                attributes: attributes,
                contentState: initialContentState,
                pushType: nil)
            print("Live Activity started with ID: \(activity.id)")
        } catch {
            print("Error starting Live Activity: \(error)")
        }
    }
}
