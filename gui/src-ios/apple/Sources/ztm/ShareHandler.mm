#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@interface ShareHandler : NSObject

+ (instancetype)sharedManager;
- (void)shareFile:(NSURL *)fileURL;
@end

@implementation ShareHandler

+ (instancetype)sharedManager {
    static ShareHandler *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[ShareHandler alloc] init];
    });
    return sharedInstance;
}

- (void)shareFile:(NSURL *)fileURL {
    if (!fileURL) {
        NSLog(@"Error: fileURL is nil.");
        return;
    }

    dispatch_async(dispatch_get_main_queue(), ^{
        // 获取顶层视图控制器
        UIViewController *rootViewController = [UIApplication sharedApplication].keyWindow.rootViewController;
        
        // 初始化分享控制器
        UIActivityViewController *activityVC = [[UIActivityViewController alloc] initWithActivityItems:@[fileURL] applicationActivities:nil];
        activityVC.popoverPresentationController.sourceView = rootViewController.view; // iPad 兼容性

        // 显示分享界面
        [rootViewController presentViewController:activityVC animated:YES completion:nil];
    });
}

@end