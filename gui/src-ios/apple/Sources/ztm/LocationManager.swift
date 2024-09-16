//
//  LocationManager.swift
//  ztm_iOS
//
//  Created by 林东臣 on 2024/9/16.
//

import Foundation
import UIKit
import CoreLocation

class LocationManager: NSObject {
    private let locationManager = CLLocationManager()

    override init() {
        super.init()

        // 请求始终允许访问位置信息的权限
        locationManager.requestWhenInUseAuthorization()
        locationManager.requestAlwaysAuthorization()
        
        // 启用后台定位模式
        locationManager.allowsBackgroundLocationUpdates = true
        
        // 当位置权限被禁止时，不会请求权限
        locationManager.pausesLocationUpdatesAutomatically = false
        
//        locationManager.delegate = self
    }

    func startLocationUpdates() {
        // 开始接收位置更新
        locationManager.startUpdatingLocation()
    }

    // CLLocationManagerDelegate 方法
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        // 当位置更新时调用
        if let location = locations.last {
            NSLog("定位更新: \(location.coordinate.latitude), \(location.coordinate.longitude)")
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        NSLog("定位失败: \(error.localizedDescription)")
    }
}
