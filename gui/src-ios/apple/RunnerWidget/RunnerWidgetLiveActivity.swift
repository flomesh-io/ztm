import ActivityKit
import WidgetKit
import SwiftUI

struct RunnerWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // 已移除 emoji
    }
    var name: String
}

struct RunnerWidgetView: View {
    var hero: String
    var isStale: Bool
    
    var body: some View {
        ZStack {
            // 使用渐变背景色
            LinearGradient(gradient: Gradient(colors: [.blue, .purple]), startPoint: .top, endPoint: .bottom)
                .edgesIgnoringSafeArea(.all)
            HStack(spacing: 0) {
                // 显示应用图标
                
                if let appIcon = UIImage(named: "SharedAppIcon") {
                    Image(uiImage: appIcon)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 40, height: 40)
                        .foregroundColor(.white)

                } else {
                    ProgressView() // 系统的圆形加载指示器
                        .progressViewStyle(CircularProgressViewStyle(tint: .white)) // 白色进度条
                        .frame(width: 40, height: 40)
                        .rotationEffect(.degrees(0)) // 初始角度
                        .rotationEffect(.degrees(360)) // 旋转到360度
                        .animation(Animation.linear(duration: 1).repeatForever(autoreverses: false)) // 线性持续旋转
                }
                VStack(alignment: .leading) {
                    Text("ZTM")
                        .font(.headline)
                        .bold()
                        .foregroundColor(.white)
                    Text("Performance in Motion")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.7))
                }
                .padding(.leading, 10) // 为标语添加一点间距
                Spacer()
            }
            .padding(.horizontal)
        }.onAppear {
//            ActivityHelper.startTimer();
        }
    }
}

struct RunnerWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RunnerWidgetAttributes.self) { context in
            RunnerWidgetView(
                hero: "ztm",
                isStale: context.isStale
            )
            .activitySystemActionForegroundColor(.white)
            .activityBackgroundTint(Color.gray.opacity(0.25))
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI
                DynamicIslandExpandedRegion(.leading) {
                    HStack {
                        if let appIcon = UIImage(named:"SharedAppIcon") {
                            Image(uiImage: appIcon)
                                .resizable()
                                .frame(width: 20, height: 20)
                                .foregroundColor(.white)

                        } else {
                            
                            ProgressView() // 系统的圆形加载指示器
                                .progressViewStyle(CircularProgressViewStyle(tint: .white)) // 白色进度条
                                .frame(width: 20, height: 20)
                                .rotationEffect(.degrees(0)) // 初始角度
                                .rotationEffect(.degrees(360)) // 旋转到360度
                                .animation(Animation.linear(duration: 1).repeatForever(autoreverses: false)) // 线性持续旋转
                        }
                        Text("ZTM Running")
                            .foregroundColor(.white)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("ZTM Running")
                        .foregroundColor(.white)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("ZTM Running")
                        .foregroundColor(.white)
                }
            } compactLeading: {
                Image("AppIcon")
                    .foregroundColor(.white)
            } compactTrailing: {
                Text("ZTM Running")
                    .foregroundColor(.white)
            } minimal: {
                Text("ZTM")
                    .foregroundColor(.white)
            }
            .keylineTint(Color.purple.opacity(0.7))
        }
    }
}

extension RunnerWidgetAttributes {
    fileprivate static var preview: RunnerWidgetAttributes {
        RunnerWidgetAttributes(name: "World")
    }
}

extension RunnerWidgetAttributes.ContentState {
    fileprivate static var smiley: RunnerWidgetAttributes.ContentState {
        RunnerWidgetAttributes.ContentState()
     }
     
     fileprivate static var starEyes: RunnerWidgetAttributes.ContentState {
         RunnerWidgetAttributes.ContentState()
     }
}

#Preview("Notification", as: .content, using: RunnerWidgetAttributes.preview) {
   RunnerWidgetLiveActivity()
} contentStates: {
    RunnerWidgetAttributes.ContentState.smiley
    RunnerWidgetAttributes.ContentState.starEyes
}
