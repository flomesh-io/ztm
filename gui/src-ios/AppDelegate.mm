#import <UIKit/UIKit.h>
#import "AppDelegate.h"
#import <Foundation/Foundation.h>

// 如果需要引入 Swift 文件，必须确保项目已经配置好 Swift-Objective-C 桥接头文件
#import "ztm-Swift.h" // 这里使用你的实际项目名称

#include <iostream> // 用于C++输出

// 使用C++的命名空间和类定义
class CustomPopup {
public:
    void show() {
        UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Custom Popup"
                                                                       message:@"This is a custom popup using Live Activity."
                                                                preferredStyle:UIAlertControllerStyleAlert];

        UIAlertAction *okAction = [UIAlertAction actionWithTitle:@"OK"
                                                           style:UIAlertActionStyleDefault
                                                         handler:^(UIAlertAction *action) {
                                                             NSLog(@"OK button tapped");
                                                         }];
        
        [alert addAction:okAction];
        // 显示弹窗，注意这里假设 rootViewController 存在
        [[UIApplication sharedApplication].keyWindow.rootViewController presentViewController:alert animated:YES completion:nil];
    }
};

// 自定义AppDelegate类，使用C++语法
@interface AppDelegate () {
    CustomPopup popup;
}
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    // 使用标准C++输出
    std::cout << "App Launched" << std::endl;
    
    // 启动Live Activity服务
    [self startLiveActivity];
    
    // 显示自定义弹窗
    popup.show();
    
    return YES;
}

// 调用Swift代码中的Live Activity启动逻辑
- (void)startLiveActivity {
    if (@available(iOS 16.1, *)) {
        std::cout << "Starting Live Activity via Swift..." << std::endl;
        [[LiveActivityManager shared] startLiveActivity];
    } else {
        std::cout << "Live Activities not supported on this version of iOS." << std::endl;
    }
}

@end
