#include <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <MediaPlayer/MediaPlayer.h>
#import <BackgroundTasks/BackgroundTasks.h>
#import <ActivityKit/ActivityKit.h>
#import <UIKit/UIKit.h>
#include "bindings/bindings.h"
#include <dlfcn.h>
//#import "AppDelegate.h"

/*
// copyLibrary(@"assets/libpipy", @"dylib", @"libpipy.dylib");
// copyLibrary(@"assets/libpipy.dylib", @"dSYM", @"libpipy.dylib.dSYM");
// copyLibrary(@"assets/libsayhello", @"dylib", @"libsayhello.dylib");
// copyLibrary(@"assets/pipy", @"framework", @"pipy.framework");
*/
void copyLibrary(NSString *resourceName, NSString *resourceType, NSString *destName) {
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSError *error = nil;

    // 获取资源路径
    NSString *resourcePath = [[NSBundle mainBundle] pathForResource:resourceName ofType:resourceType];
    if (resourcePath == nil) {
        NSLog(@"libpipy Failed to get resource path for %@", resourceName);
        return;
    }

    // 获取目标路径 (应用的文档目录)
        NSArray *paths = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES);
        NSString *libraryDirectory = [paths objectAtIndex:0];
        NSLog(@"libpipy libraryDirectory is %@", libraryDirectory);
        NSString *targetPath = [libraryDirectory stringByAppendingPathComponent:destName];
        NSLog(@"libpipy targetPath is %@", targetPath);
    // 复制文件
    if ([fileManager fileExistsAtPath:targetPath]) {
        NSLog(@"libpipy File already exists at target path: %@", targetPath);
    } else {
        if (![fileManager copyItemAtPath:resourcePath toPath:targetPath error:&error]) {
            NSLog(@"libpipy Failed to copy file: %@", [error localizedDescription]);
        } else {
            NSLog(@"libpipy File copied successfully to %@", targetPath);
        }
    }
}


void callPipyMain(int argc, char * arguments[]) {
    // 获取 libpipy.dylib 的路径
    NSString *path = [[NSBundle mainBundle] pathForResource:@"assets/libpipy" ofType:@"dylib"];
    if (!path) {
        NSLog(@"callPipyMain 未找到动态库 libpipy.dylib");
        return;
    }

    // 加载动态库
    void *handle = dlopen([path UTF8String], RTLD_NOW);
    if (!handle) {
        const char *error = dlerror();
        if (error) {
            NSLog(@"callPipyMain 加载动态库失败: %s", error);
        }
        return;
    }

    // 获取 pipy_main 函数指针
    const char *symbolName = "pipy_main";
    typedef int (*PipyMainFunction)(int, char **);
    PipyMainFunction pipyMain = (PipyMainFunction)dlsym(handle, symbolName);
    if (!pipyMain) {
        NSLog(@"callPipyMain 未找到符号: %s", symbolName);
        dlclose(handle);
        return;
    }

        // int argCount = sizeof(arguments) / sizeof(arguments[0]);
    // 调用 pipy_main 函数
    int result = pipyMain(argc, arguments);

    // 输出结果
    NSLog(@"callPipyMain pipy_main 返回值: %d", result);

    // 关闭动态库
    dlclose(handle);
}

void startPipyInNewThread() {
        // 创建一个后台任务
    __block UIBackgroundTaskIdentifier bgTask = [[UIApplication sharedApplication] beginBackgroundTaskWithExpirationHandler:^{
        [[UIApplication sharedApplication] endBackgroundTask:bgTask];
        bgTask = UIBackgroundTaskInvalid;
    }];
            
    // 创建一个新的线程来调用 callPipyMain
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
            NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
            NSString *documentDirectory = [paths objectAtIndex:0];
            NSLog(@"libpipy documentDirectory is %@", documentDirectory);
            NSString *ztmdbPath = [documentDirectory stringByAppendingPathComponent:@"ztmdb"];
            const char *args[] = {"--pipy", "repo://ztm/agent", "--args", "--data", [ztmdbPath UTF8String], "--listen", "7777", "--pipy-options", "--log-local-only"};
            int argCount = sizeof(args) / sizeof(args[0]);
            
            int result = ffi::pipy_main(argCount, (char **)args);
            NSLog(@"callPipyMain pipy_main 返回值: %d", result);
            
            // 当任务完成后，结束后台任务
            if (bgTask != UIBackgroundTaskInvalid) {
                [[UIApplication sharedApplication] endBackgroundTask:bgTask];
                bgTask = UIBackgroundTaskInvalid;
            }
    });
}

// 配置 AVAudioSession
void configureAudioSession() {
    NSError *error = nil;
    AVAudioSession *session = [AVAudioSession sharedInstance];
    BOOL success = [session setCategory:AVAudioSessionCategoryPlayback
                                withOptions:AVAudioSessionCategoryOptionMixWithOthers
                                      error:&error];

    if (!success || error) {
        NSLog(@"设置音频会话类别失败: %@", error.localizedDescription.UTF8String);
    }

    // 激活音频会话
    [session setActive:YES error:&error];
    if (!success || error) {
        NSLog(@"激活音频会话失败: %@", error.localizedDescription.UTF8String);
    }
}
void setupRemoteCommandCenter() {
    MPRemoteCommandCenter *commandCenter = [MPRemoteCommandCenter sharedCommandCenter];
    
    [commandCenter.playCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *event) {
        NSLog(@"播放命令触发");
        return MPRemoteCommandHandlerStatusSuccess;
    }];
    
    [commandCenter.pauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *event) {
        NSLog(@"暂停命令触发");
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
        NSLog(@"后台处理任务提交成功");
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
     startPipyInNewThread();

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
    startPipyInNewThread();   // 启动 Pipy
    scheduleBackgroundTask();

    return true;
}
//void startApplication() {
//    UIApplication *application = [UIApplication sharedApplication];
//    AppDelegate *appDelegate = [[AppDelegate alloc] init];
//    application.delegate = appDelegate;
//}
int main(int argc, char * argv[]) {
    @autoreleasepool {
        
        // 启动后台任务
        UIApplication *application = [UIApplication sharedApplication];
        applicationDidFinishLaunchingWithOptions(application, nil);
        // 手动创建 UIApplication 实例和 AppDelegate
//        startApplication();
        ffi::start_app();
        return 0;
    }
}
