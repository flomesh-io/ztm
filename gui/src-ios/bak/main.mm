#include <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <MediaPlayer/MediaPlayer.h>
#import <BackgroundTasks/BackgroundTasks.h>
#import <UIKit/UIKit.h>
#include "bindings/bindings.h"
#include <dlfcn.h>
#import "ztm-Swift.h"


// 配置 AVAudioSession
void configureAudioSession() {
    NSError *error = nil;
    AVAudioSession *session = [AVAudioSession sharedInstance];
    BOOL success = [session setCategory:AVAudioSessionCategoryPlayback
                                withOptions:AVAudioSessionCategoryOptionMixWithOthers
                                      error:&error];

    if (!success || error) {
        NSLog(@"调试-设置音频会话类别失败: %@", error.localizedDescription.UTF8String);
    }

    // 激活音频会话
    [session setActive:YES error:&error];
    if (!success || error) {
        NSLog(@"调试-激活音频会话失败: %@", error.localizedDescription.UTF8String);
    }
}
void setupRemoteCommandCenter() {
    MPRemoteCommandCenter *commandCenter = [MPRemoteCommandCenter sharedCommandCenter];
    
    [commandCenter.playCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *event) {
        NSLog(@"调试-播放命令触发");
        return MPRemoteCommandHandlerStatusSuccess;
    }];
    
    [commandCenter.pauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *event) {
        NSLog(@"调试-暂停命令触发");
        return MPRemoteCommandHandlerStatusSuccess;
    }];
}
// 设置 Now Playing 信息，让系统锁屏时显示控制浮窗
void setupNowPlayingInfo() {
    MPNowPlayingInfoCenter *center = [MPNowPlayingInfoCenter defaultCenter];
    NSMutableDictionary *info = [NSMutableDictionary dictionary];

    [info setObject:@"ZTM Running" forKey:MPMediaItemPropertyTitle]; // 设置标题
    [info setObject:@"Flomesh" forKey:MPMediaItemPropertyArtist];       // 设置描述

    [info setObject:@(600.0) forKey:MPMediaItemPropertyPlaybackDuration]; // 假装持续时间为60秒
    [info setObject:@(0.0) forKey:MPNowPlayingInfoPropertyElapsedPlaybackTime]; // 假装已播放0秒

    // 显示信息
    center.nowPlayingInfo = info;
    [center setNowPlayingInfo:info];
    NSLog(@"Now Playing 信息已设置");
}

void scheduleBackgroundTask() {
    BGProcessingTaskRequest *request = [[BGProcessingTaskRequest alloc] initWithIdentifier:@"com.flomesh.ztm.pipy"];
    request.requiresNetworkConnectivity = YES;  // 需要网络连接
    request.requiresExternalPower = NO;         // 不需要外部电源

    NSError *error = nil;
    BOOL success = [[BGTaskScheduler sharedScheduler] submitTaskRequest:request error:&error];
    if (!success) {
        NSLog(@"提交后台处理任务失败: %@", error);
    } else {
        NSLog(@"调试-后台处理任务提交成功");
    }
}

// 处理后台任务
void handleBackgroundTask(BGProcessingTask *task) {
     // 确保后台任务不会被立即挂起
     task.expirationHandler = ^{
             // 任务到期时调用
             [task setTaskCompletedWithSuccess:NO];
             scheduleBackgroundTask();  // 重新调度任务
     };

     // 启动 Pipy
//    [ActivityHelper playPipy];

     // 完成任务后调用
     [task setTaskCompletedWithSuccess:YES];
}

// 注册后台任务
void registerBackgroundTasks() {
    [[BGTaskScheduler sharedScheduler] registerForTaskWithIdentifier:@"com.flomesh.ztm.pipy" usingQueue:nil launchHandler:^(BGTask *task) {
        handleBackgroundTask((BGProcessingTask *)task);
    }];
}

// 应用启动时调用
bool applicationDidFinishLaunchingWithOptions(UIApplication *application, NSDictionary *launchOptions) {
    
    registerBackgroundTasks();
    configureAudioSession();  // 配置音频会话，使应用可以在后台运行
    setupNowPlayingInfo();    // 设置锁屏时的显示信息
    setupRemoteCommandCenter();
    scheduleBackgroundTask();

    return true;
}

int main(int argc, char * argv[]) {
    @autoreleasepool {
//        [ActivityHelper startLiveActivityWithID:@"com.flomesh.ztm.pipy"];
//        UIApplication *application = [UIApplication sharedApplication];
//        applicationDidFinishLaunchingWithOptions(application, nil);
//        registerBackgroundTasks();
//        [ActivityHelper playPipy];
        [ActivityHelper watchEvent];
        [ActivityHelper startLiveActivity];
//        [ActivityHelper startTimer];
//
//
//        NSLog(@"调试-reloadWidgets");
//        [WidgetHelper reloadWidgets];
//        NSLog(@"调试-start_app");
        ffi::start_app();
        return 0;
    }
}

