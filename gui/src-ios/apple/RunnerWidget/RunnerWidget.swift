//
//  RunnerWidget.swift
//  RunnerWidget
//
//  Created by 林东臣 on 2024/9/14.
//

import WidgetKit
import SwiftUI
import ActivityKit

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), emoji: "")
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), emoji: "")
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        var entries: [SimpleEntry] = []

        // Generate a timeline consisting of five entries an hour apart, starting from the current date.
        // 从当前时间开始，每分钟生成一个新的条目，持续 60 分钟
        let currentDate = Date()
        for minuteOffset in 0 ..< 60 {
            let entryDate = Calendar.current.date(byAdding: .minute, value: minuteOffset, to: currentDate)!
            let entry = SimpleEntry(date: entryDate, emoji: "")
            entries.append(entry)
        }

        // 使用 .atEnd 策略，确保到最后一个条目后会请求新的更新
        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let emoji: String
}
struct RunnerWidgetEntryView : View {
    var entry: Provider.Entry
    
    var body: some View {
        GeometryReader { geometry in
            VStack(spacing:0) {
                VStack {
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
                    Text("ZTM")
                        .font(.headline)
                        .bold()
                        .foregroundColor(.white)
                }
                VStack {
                    Text("Listening to port 7777")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.7))
                    
                    Text(entry.date, style: .time)
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.5))
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height) // Match widget size
            .background(LinearGradient(gradient: Gradient(colors: [.blue, .purple]), startPoint: .top, endPoint: .bottom))
            .ignoresSafeArea() // Fill the entire widget area
        }
    }
}

extension WidgetConfiguration
{
    func contentMarginsDisabledIfAvailable() -> some WidgetConfiguration
    {
        if #available(iOSApplicationExtension 17.0, *)
        {
            return self.contentMarginsDisabled()
        }
        else
        {
            return self
        }
    }
}
struct RunnerWidget: Widget {
    let kind: String = "RunnerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                RunnerWidgetEntryView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
                    
            } else {
                RunnerWidgetEntryView(entry: entry)
                    .unredacted()
//                    .padding()
//                    .background()
            }
            
            
        }
        .configurationDisplayName("ZTM Widget")
        .description("Listen to port 7777")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabledIfAvailable()
    }
}
